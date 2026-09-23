/**
 * Manual staging figure build: Tripo GLB + USDZ → R2 staging keys only.
 * Never writes production `models/.../figurine.glb`. Idempotent on jobId.
 */

import {
  FIGURINE_MAX_GLB_BYTES,
  FIGURINE_PROVIDER_TIMEOUT_MS,
  FIGURINE_RETOPO_FACE_LIMIT,
  FIGURINE_RETOPO_TIMEOUT_MS,
  FIGURE_STAGING_USDZ_CONTENT_TYPE,
  FigureStagingError,
  assertFigureStagingEnvironment,
  assertUsdzArtifact,
  createInitialFigureAssets,
  figureStagingGlbKey,
  figureStagingUsdzKey,
  markFigureAssetsFailed,
  markFigureAssetsProcessing,
  markFigureAssetsReady,
  type FigureAssets,
  type FigureGenerationJob,
  type FigureStagingErrorCode,
  type PublicArtifactStorage
} from "@kidar/core";
import { sha256Hex } from "@kidar/core/hash";
import { optimizeGlb } from "../popout/optimize";
import {
  createTripoProvider,
  type TripoImageToModelProvider,
  type TripoTaskSnapshot
} from "../tripo/client";
import { isTripoConfigured, requireTripoConfig } from "../tripo/config";
import { validateFigurineGlb } from "./validate-glb";

export type FigureStagingProgress = {
  phase:
    | "guard"
    | "submitting"
    | "provider_running"
    | "retopologizing"
    | "converting"
    | "validating"
    | "uploading"
    | "ready"
    | "failed";
  progress: number;
  providerTaskId?: string;
  retopoTaskId?: string;
  convertTaskId?: string;
  assets?: FigureAssets;
};

export type FigureStagingStageDeps = {
  storage: PublicArtifactStorage;
  provider?: TripoImageToModelProvider;
  loadSource: (sourceImageUrl: string) => Promise<Uint8Array>;
  onProgress?: (patch: FigureStagingProgress) => Promise<void> | void;
  persistAssets?: (assets: FigureAssets) => Promise<void> | void;
  /** Previously persisted Tripo ids — reused on retry so Tripo is not paid twice. */
  priorTaskIds?: {
    providerTaskId?: string;
    retopoTaskId?: string;
    convertTaskId?: string;
  };
  env?: NodeJS.ProcessEnv;
  nowMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  providerTimeoutMs?: number;
  retopoTimeoutMs?: number;
  convertTimeoutMs?: number;
};

export type FigureStagingStageResult = {
  kind: "written" | "idempotent";
  assets: FigureAssets;
  glbKey: string;
  usdzKey: string;
  providerTaskId: string;
  retopoTaskId: string;
  convertTaskId: string;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapStagingCode(error: unknown): FigureStagingErrorCode {
  if (error instanceof FigureStagingError) return error.code;
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: string }).code);
    if (code === "TRIPO_CONFIG_MISSING") return "TRIPO_CONFIG_MISSING";
    if (code.startsWith("TRIPO_") && /TRANSIENT|TIMEOUT|NETWORK|DOWNLOAD/i.test(code)) {
      return "TRIPO_TRANSIENT";
    }
    if (code.startsWith("TRIPO_")) return "TRIPO_REJECTED";
    if (code.includes("GLB") || code === "MESH_TOO_DENSE") return "GLB_INVALID";
  }
  return "TRIPO_REJECTED";
}

async function pollUntilSuccess(input: {
  provider: TripoImageToModelProvider;
  taskId: string;
  timeoutMs: number;
  nowMs: () => number;
  sleep: (ms: number) => Promise<void>;
  pollIntervalMs: number;
  timeoutCode: FigureStagingErrorCode;
  failedCode: FigureStagingErrorCode;
  requireModelUrl: boolean;
  onTick?: (snap: TripoTaskSnapshot) => Promise<void> | void;
}): Promise<TripoTaskSnapshot> {
  const deadline = input.nowMs() + input.timeoutMs;
  while (input.nowMs() < deadline) {
    const snap = await input.provider.getTask(input.taskId);
    await input.onTick?.(snap);
    if (snap.status === "success") {
      if (input.requireModelUrl && !snap.modelUrl) {
        throw new FigureStagingError("Tripo task succeeded without model URL", {
          retryable: true,
          code: input.failedCode
        });
      }
      return snap;
    }
    if (snap.status === "failed" || snap.status === "cancelled" || snap.status === "banned") {
      throw new FigureStagingError(snap.errorMessage || "Tripo task failed", {
        retryable: false,
        code: input.failedCode
      });
    }
    await input.sleep(input.pollIntervalMs);
  }
  throw new FigureStagingError("Tripo task timed out", {
    retryable: true,
    code: input.timeoutCode
  });
}

/**
 * Run one internal staging figure job. Caller must supply staging-only env.
 */
export async function runFigureStagingBuild(
  job: FigureGenerationJob,
  deps: FigureStagingStageDeps
): Promise<FigureStagingStageResult> {
  const env = deps.env ?? process.env;
  const nowMs = deps.nowMs ?? Date.now;
  const sleep = deps.sleep ?? sleepMs;
  const pollIntervalMs = deps.pollIntervalMs ?? 2_000;
  const providerTimeoutMs = deps.providerTimeoutMs ?? FIGURINE_PROVIDER_TIMEOUT_MS;
  const retopoTimeoutMs = deps.retopoTimeoutMs ?? FIGURINE_RETOPO_TIMEOUT_MS;
  const convertTimeoutMs = deps.convertTimeoutMs ?? FIGURINE_PROVIDER_TIMEOUT_MS;

  let assets = createInitialFigureAssets(job.projectId, new Date(nowMs()));

  const fail = async (error: unknown): Promise<never> => {
    const code = mapStagingCode(error);
    assets = markFigureAssetsFailed(assets, code, new Date(nowMs()));
    await deps.persistAssets?.(assets);
    await deps.onProgress?.({ phase: "failed", progress: 0, assets });
    if (error instanceof FigureStagingError) throw error;
    throw new FigureStagingError(
      error instanceof Error ? error.message.slice(0, 200) : "Staging figure build failed",
      { retryable: false, code }
    );
  };

  try {
    assertFigureStagingEnvironment({
      jobEnvironment: job.environment,
      r2Bucket: env.R2_BUCKET,
      stagingBucket: env.R2_STAGING_BUCKET,
      appwriteProjectId: env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || env.APPWRITE_PROJECT_ID,
      productionAppwriteProjectId: env.KIDAR_PRODUCTION_APPWRITE_PROJECT_ID
    });

    if (job.requestedBy !== "internal") {
      throw new FigureStagingError("Staging figure jobs must be requestedBy internal", {
        retryable: false,
        code: "STAGING_GUARD"
      });
    }
    if (
      job.requestedFormats[0] !== "glb" ||
      job.requestedFormats[1] !== "usdz" ||
      job.requestedFormats.length !== 2
    ) {
      throw new FigureStagingError("Staging figure jobs require formats glb and usdz", {
        retryable: false,
        code: "STAGING_GUARD"
      });
    }

    await deps.onProgress?.({ phase: "guard", progress: 2 });

    const glbKey = figureStagingGlbKey(job.projectId, job.jobId);
    const usdzKey = figureStagingUsdzKey(job.projectId, job.jobId);
    const existingGlb = await deps.storage.getMetadata(glbKey);
    const existingUsdz = await deps.storage.getMetadata(usdzKey);
    if (existingGlb && existingUsdz) {
      assets = markFigureAssetsReady(
        assets,
        { jobId: job.jobId, glbKey, usdzKey },
        new Date(nowMs())
      );
      await deps.persistAssets?.(assets);
      await deps.onProgress?.({
        phase: "ready",
        progress: 100,
        providerTaskId: deps.priorTaskIds?.providerTaskId,
        retopoTaskId: deps.priorTaskIds?.retopoTaskId,
        convertTaskId: deps.priorTaskIds?.convertTaskId,
        assets
      });
      return {
        kind: "idempotent",
        assets,
        glbKey,
        usdzKey,
        providerTaskId: deps.priorTaskIds?.providerTaskId || "cached",
        retopoTaskId: deps.priorTaskIds?.retopoTaskId || "cached",
        convertTaskId: deps.priorTaskIds?.convertTaskId || "cached"
      };
    }

    assets = markFigureAssetsProcessing(assets, new Date(nowMs()));
    await deps.persistAssets?.(assets);

    if (!isTripoConfigured(env) && !deps.provider) {
      throw new FigureStagingError("Configurarea 3D nu este disponibilă încă", {
        retryable: false,
        code: "TRIPO_CONFIG_MISSING"
      });
    }
    const provider = deps.provider ?? createTripoProvider(requireTripoConfig(env));

    const sourceBytes = await deps.loadSource(job.sourceImageUrl);
    if (!sourceBytes.byteLength) {
      throw new FigureStagingError("Source image is empty", {
        retryable: false,
        code: "SOURCE_INVALID"
      });
    }

    let providerTaskId = deps.priorTaskIds?.providerTaskId?.trim() || "";
    let retopoTaskId = deps.priorTaskIds?.retopoTaskId?.trim() || "";
    let convertTaskId = deps.priorTaskIds?.convertTaskId?.trim() || "";

    if (!providerTaskId) {
      await deps.onProgress?.({ phase: "submitting", progress: 5 });
      const isPng =
        sourceBytes[0] === 0x89 && sourceBytes[1] === 0x50 && sourceBytes[2] === 0x4e;
      const uploaded = await provider.uploadImage({
        bytes: sourceBytes,
        filename: isPng ? "subject.png" : "subject.jpg",
        contentType: isPng ? "image/png" : "image/jpeg"
      });
      const submitted = await provider.submitImageToModel({ fileToken: uploaded.fileToken });
      providerTaskId = submitted.providerTaskId;
      await deps.onProgress?.({
        phase: "provider_running",
        progress: 10,
        providerTaskId
      });
    }

    await pollUntilSuccess({
      provider,
      taskId: providerTaskId,
      timeoutMs: providerTimeoutMs,
      nowMs,
      sleep,
      pollIntervalMs,
      timeoutCode: "TRIPO_TRANSIENT",
      failedCode: "TRIPO_REJECTED",
      requireModelUrl: false,
      onTick: async (snap) => {
        await deps.onProgress?.({
          phase: "provider_running",
          progress: Math.max(15, Math.min(55, snap.progress || 15)),
          providerTaskId
        });
      }
    });

    if (!retopoTaskId) {
      await deps.onProgress?.({
        phase: "retopologizing",
        progress: 58,
        providerTaskId
      });
      const retopo = await provider.submitMeshDecimate({
        sourceTaskId: providerTaskId,
        faceLimit: FIGURINE_RETOPO_FACE_LIMIT,
        bake: true
      });
      retopoTaskId = retopo.providerTaskId;
      await deps.onProgress?.({
        phase: "retopologizing",
        progress: 60,
        providerTaskId,
        retopoTaskId
      });
    }

    const retopoSnap = await pollUntilSuccess({
      provider,
      taskId: retopoTaskId,
      timeoutMs: retopoTimeoutMs,
      nowMs,
      sleep,
      pollIntervalMs,
      timeoutCode: "TRIPO_TRANSIENT",
      failedCode: "TRIPO_REJECTED",
      requireModelUrl: true,
      onTick: async (snap) => {
        await deps.onProgress?.({
          phase: "retopologizing",
          progress: Math.max(60, Math.min(82, 60 + Math.round((snap.progress || 0) * 0.22))),
          providerTaskId,
          retopoTaskId
        });
      }
    });

    if (!convertTaskId) {
      await deps.onProgress?.({
        phase: "converting",
        progress: 84,
        providerTaskId,
        retopoTaskId
      });
      const converted = await provider.submitModelConvert({
        sourceTaskId: retopoTaskId,
        format: "USDZ"
      });
      convertTaskId = converted.providerTaskId;
      await deps.onProgress?.({
        phase: "converting",
        progress: 86,
        providerTaskId,
        retopoTaskId,
        convertTaskId
      });
    }

    const convertSnap = await pollUntilSuccess({
      provider,
      taskId: convertTaskId,
      timeoutMs: convertTimeoutMs,
      nowMs,
      sleep,
      pollIntervalMs,
      timeoutCode: "TRIPO_TRANSIENT",
      failedCode: "TRIPO_REJECTED",
      requireModelUrl: true,
      onTick: async (snap) => {
        await deps.onProgress?.({
          phase: "converting",
          progress: Math.max(86, Math.min(90, 86 + Math.round((snap.progress || 0) * 0.04))),
          providerTaskId,
          retopoTaskId,
          convertTaskId
        });
      }
    });

    await deps.onProgress?.({
      phase: "validating",
      progress: 92,
      providerTaskId,
      retopoTaskId,
      convertTaskId
    });

    const glbRaw = await provider.downloadModel(retopoSnap.modelUrl!);
    if (glbRaw.byteLength > FIGURINE_MAX_GLB_BYTES) {
      throw new FigureStagingError("Figurine GLB exceeds maximum size", {
        retryable: false,
        code: "GLB_INVALID"
      });
    }
    await validateFigurineGlb(glbRaw);
    const { bytes: glbOptimized } = await optimizeGlb(glbRaw);
    await validateFigurineGlb(glbOptimized);

    const usdzRaw = await provider.downloadModel(convertSnap.modelUrl!);
    assertUsdzArtifact(usdzRaw);

    await deps.onProgress?.({
      phase: "uploading",
      progress: 95,
      providerTaskId,
      retopoTaskId,
      convertTaskId
    });

    const glbChecksum = sha256Hex(glbOptimized);
    const usdzChecksum = sha256Hex(usdzRaw);

    await deps.storage.write({
      key: glbKey,
      body: glbOptimized,
      contentType: "model/gltf-binary",
      cacheControl: "public, max-age=31536000, immutable",
      checksum: glbChecksum
    });
    await deps.storage.write({
      key: usdzKey,
      body: usdzRaw,
      contentType: FIGURE_STAGING_USDZ_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
      checksum: usdzChecksum
    });

    const glbMeta = await deps.storage.getMetadata(glbKey);
    const usdzMeta = await deps.storage.getMetadata(usdzKey);
    if (!glbMeta || !usdzMeta) {
      throw new FigureStagingError("Staging artifact verify failed after write", {
        retryable: true,
        code: "UPLOAD_FAILED"
      });
    }

    assets = markFigureAssetsReady(
      assets,
      { jobId: job.jobId, glbKey, usdzKey },
      new Date(nowMs())
    );
    await deps.persistAssets?.(assets);
    await deps.onProgress?.({
      phase: "ready",
      progress: 100,
      providerTaskId,
      retopoTaskId,
      convertTaskId,
      assets
    });

    return {
      kind: "written",
      assets,
      glbKey,
      usdzKey,
      providerTaskId,
      retopoTaskId,
      convertTaskId
    };
  } catch (error) {
    return fail(error);
  }
}
