/**
 * Tripo Image-to-3D provider adapter (OpenAPI v3).
 * Documented endpoints only; no live calls in tests (inject fetch).
 */

import {
  FIGURINE_PROVIDER_TIMEOUT_MS,
  FigurineBuildError
} from "@kidar/core";
import {
  TRIPO_IMAGE_TO_MODEL_MODEL,
  type TripoConfig,
  requireTripoConfig
} from "./config";

export type TripoTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "banned"
  | "unknown";

export type TripoTaskSnapshot = {
  status: TripoTaskStatus;
  progress: number;
  modelUrl?: string;
  previewUrl?: string;
  errorCode?: string;
  errorMessage?: string;
};

export interface TripoImageToModelProvider {
  uploadImage(input: {
    bytes: Uint8Array;
    filename: string;
    contentType: string;
  }): Promise<{ fileToken: string }>;
  submitImageToModel(input: { fileToken: string }): Promise<{ providerTaskId: string }>;
  getTask(providerTaskId: string): Promise<TripoTaskSnapshot>;
  downloadModel(modelUrl: string): Promise<Buffer>;
}

export type TripoFetch = typeof fetch;

function authHeaders(apiKey: string, contentType?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function sanitizeProviderMessage(raw: unknown): string {
  const text = typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'\\]+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function mapStatus(raw: unknown): TripoTaskStatus {
  const s = String(raw ?? "").toLowerCase();
  if (
    s === "queued" ||
    s === "running" ||
    s === "success" ||
    s === "failed" ||
    s === "cancelled" ||
    s === "banned"
  ) {
    return s;
  }
  // Older aliases seen in docs examples
  if (s === "pending") return "queued";
  if (s === "completed" || s === "done") return "success";
  if (s === "error") return "failed";
  return "unknown";
}

function extractModelUrl(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  for (const key of ["model", "pbr_model", "base_model", "model_url"]) {
    const value = output[key];
    if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  }
  return undefined;
}

function extractPreviewUrl(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  for (const key of ["rendered_image", "preview", "thumbnail"]) {
    const value = output[key];
    if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  }
  return undefined;
}

function isRetryableHttp(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

export function createTripoProvider(
  config: TripoConfig,
  deps?: { fetch?: TripoFetch; downloadTimeoutMs?: number }
): TripoImageToModelProvider {
  const doFetch = deps?.fetch ?? fetch;
  const downloadTimeoutMs = deps?.downloadTimeoutMs ?? 120_000;

  async function request(
    path: string,
    init: RequestInit,
    options?: { retryableDefault?: boolean }
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await doFetch(`${config.baseUrl}${path}`, init);
    } catch (error) {
      throw new FigurineBuildError(
        `Tripo network error: ${sanitizeProviderMessage(error instanceof Error ? error.message : "failed")}`,
        { retryable: true, code: "TRIPO_NETWORK" }
      );
    }

    const body = await readJson(response);
    if (!response.ok) {
      const message =
        sanitizeProviderMessage(body.message ?? body.error ?? `HTTP ${response.status}`) ||
        `Tripo HTTP ${response.status}`;
      throw new FigurineBuildError(message, {
        retryable: isRetryableHttp(response.status),
        code: isRetryableHttp(response.status) ? "TRIPO_TRANSIENT" : "TRIPO_REJECTED"
      });
    }
    return body;
  }

  return {
    async uploadImage(input) {
      const form = new FormData();
      const blob = new Blob([Buffer.from(input.bytes)], { type: input.contentType });
      form.append("file", blob, input.filename);
      const body = await request("/files", {
        method: "POST",
        headers: authHeaders(config.apiKey),
        body: form
      });
      const data = (body.data as Record<string, unknown> | undefined) ?? body;
      const fileToken = typeof data.file_token === "string" ? data.file_token : "";
      if (!fileToken) {
        throw new FigurineBuildError("Tripo upload did not return file_token", {
          retryable: false,
          code: "TRIPO_UPLOAD_INVALID"
        });
      }
      return { fileToken };
    },

    async submitImageToModel(input) {
      const body = await request(
        "/generation/image-to-model",
        {
          method: "POST",
          headers: authHeaders(config.apiKey, "application/json"),
          body: JSON.stringify({
            input: input.fileToken,
            model: TRIPO_IMAGE_TO_MODEL_MODEL,
            texture: true
          })
        },
        { retryableDefault: true }
      );
      const data = (body.data as Record<string, unknown> | undefined) ?? body;
      const providerTaskId =
        typeof data.task_id === "string"
          ? data.task_id
          : typeof data.taskId === "string"
            ? data.taskId
            : "";
      if (!providerTaskId) {
        throw new FigurineBuildError("Tripo submit did not return task_id", {
          retryable: false,
          code: "TRIPO_SUBMIT_INVALID"
        });
      }
      return { providerTaskId };
    },

    async getTask(providerTaskId) {
      const body = await request(`/tasks/${encodeURIComponent(providerTaskId)}`, {
        method: "GET",
        headers: authHeaders(config.apiKey)
      });
      const data = ((body.data as Record<string, unknown> | undefined) ?? body) as Record<
        string,
        unknown
      >;
      const output = (data.output as Record<string, unknown> | undefined) ?? undefined;
      const progressRaw = Number(data.progress ?? 0);
      const progress = Number.isFinite(progressRaw)
        ? Math.max(0, Math.min(100, Math.round(progressRaw)))
        : 0;
      const status = mapStatus(data.status);
      const errorMessage = sanitizeProviderMessage(
        data.error_msg ?? data.error_message ?? data.message ?? ""
      );
      return {
        status,
        progress,
        modelUrl: extractModelUrl(output),
        previewUrl: extractPreviewUrl(output),
        errorCode: typeof data.error_code === "string" ? data.error_code : undefined,
        errorMessage: errorMessage || undefined
      };
    },

    async downloadModel(modelUrl) {
      if (!/^https:\/\//i.test(modelUrl)) {
        throw new FigurineBuildError("Tripo model URL must be https", {
          retryable: false,
          code: "TRIPO_MODEL_URL_INVALID"
        });
      }
      let response: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), downloadTimeoutMs);
        try {
          response = await doFetch(modelUrl, { method: "GET", signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        throw new FigurineBuildError(
          `Tripo model download failed: ${sanitizeProviderMessage(error instanceof Error ? error.message : "failed")}`,
          { retryable: true, code: "TRIPO_DOWNLOAD_NETWORK" }
        );
      }
      if (!response.ok) {
        throw new FigurineBuildError(`Tripo model download HTTP ${response.status}`, {
          retryable: isRetryableHttp(response.status),
          code: "TRIPO_DOWNLOAD_HTTP"
        });
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) {
        throw new FigurineBuildError("Tripo model download was empty", {
          retryable: false,
          code: "TRIPO_DOWNLOAD_EMPTY"
        });
      }
      return buffer;
    }
  };
}

export function getTripoProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  deps?: { fetch?: TripoFetch }
): TripoImageToModelProvider {
  return createTripoProvider(requireTripoConfig(env), deps);
}

export { FIGURINE_PROVIDER_TIMEOUT_MS };
