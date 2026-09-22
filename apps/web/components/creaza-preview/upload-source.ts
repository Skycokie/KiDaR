/**
 * Source Go B — single POST /api/projects/:projectId/source from `/creaza-preview`.
 * Stores only `sourceUrl` from the response. Never PATCHes settings or creates projects.
 */

import { sourceUploadPath, validateSourceImage } from "@/lib/simple-creator";

export type SourceUploadClientError =
  | "missing-project"
  | "missing-photo"
  | "type"
  | "size"
  | "auth"
  | "not-found"
  | "generic"
  | "network";

export type SourceUploadResult =
  | { ok: true; sourceUrl: string }
  | {
      ok: false;
      error: "auth" | "not-found" | "type" | "size" | "generic" | "network";
    };

export function buildSourceUploadFormData(file: File): FormData {
  const body = new FormData();
  body.set("file", file);
  return body;
}

export function extractSourceUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const sourceUrl = (body as { sourceUrl?: unknown }).sourceUrl;
  if (typeof sourceUrl === "string" && sourceUrl.trim()) return sourceUrl.trim();
  return null;
}

/**
 * Interprets a settled upload response. Does not auto-retry.
 */
export async function interpretSourceUploadResponse(
  response: Response
): Promise<SourceUploadResult> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 200) {
    const sourceUrl = extractSourceUrl(body);
    if (!sourceUrl) {
      return { ok: false, error: "generic" };
    }
    return { ok: true, sourceUrl };
  }

  if (response.status === 401) {
    return { ok: false, error: "auth" };
  }

  if (response.status === 404) {
    return { ok: false, error: "not-found" };
  }

  if (response.status === 413) {
    return { ok: false, error: "size" };
  }

  if (response.status === 415) {
    return { ok: false, error: "type" };
  }

  return { ok: false, error: "generic" };
}

export async function postSourceUpload(
  projectId: string,
  file: File,
  fetchImpl: typeof fetch = fetch
): Promise<SourceUploadResult> {
  const validation = validateSourceImage(file);
  if (!validation.ok) {
    // Caller should gate this; treat as generic if reached.
    return { ok: false, error: "generic" };
  }

  const url = sourceUploadPath(projectId);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      body: buildSourceUploadFormData(file)
    });
  } catch {
    return { ok: false, error: "network" };
  }
  return interpretSourceUploadResponse(response);
}

export function isSourceUploadPath(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";
  return /^\/api\/projects\/[^/]+\/source$/.test(path);
}
