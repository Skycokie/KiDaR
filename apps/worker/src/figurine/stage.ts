/**
 * figurine_build worker stage — Tripo image-to-3D → validate → R2 public GLB.
 */

import {
  FIGURINE_MAX_GLB_BYTES,
  FIGURINE_PROVIDER,
  FIGURINE_PROVIDER_TIMEOUT_MS,
  FigurineBuildError,
  PublicStorageConfigError,
  assertFigurineInputs,
  assertFigurineSubjectSuitable,
  detectFigurineImageMime,
  figurineArtifactKey,
  figurinePipelineLabel,
  type FigurinePhase,
  type FigurineSubjectRecord,
  type PipelineJob,
  type PublicArtifactStorage
} from "@kidar/core";
import { computeArtifactHash, sha256Hex } from "@kidar/core/hash";
import {
  completeJob,
  downloadSourceFile,
  failJob,
  getProjectRecord,
  markProjectStatus,
  patchRunningJobResult
} from "../appwrite/jobs";
import { optimizeGlb } from "../popout/optimize";
import {
  createTripoProvider,
  type TripoImageToModelProvider
} from "../tripo/client";
import { isTripoConfigured, requireTripoConfig } from "../tripo/config";
import { inspectFigurineSubject } from "./inspect-subject";
import { validateFigurineGlb } from "./validate-glb";

export type FigurineStageDeps = {
  storage: PublicArtifactStorage;
  provider?: TripoImageToModelProvider;
  loadSource?: (fileId: string) => Promise<Uint8Array>;
  loadProject?: typeof getProjectRecord;
  complete?: typeof completeJob;
  fail?: typeof failJob;
  patchProgress?: typeof patchRunningJobResult;
  markProject?: typeof markProjectStatus;
  inspectSubject?: typeof inspectFigurineSubject;
  nowMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  providerTimeoutMs?: number;
};

export type FigurineStageResult = {
  kind: "written" | "idempotent";
  artifactKey: string;
  artifactHash: string;
  publicUrl: string;
  providerTaskId: string;
  rawBytes: number;
  optimizedBytes: number;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phaseProgress(phase: FigurinePhase, providerProgress?: number): number {
  switch (phase) {
    case "queued":
      return 0;
    case "submitting":
      return 5;
    case "provider_queued":
      return 10;
    case "provider_running":
      return Math.max(15, Math.min(80, providerProgress ?? 15));
    case "downloading":
      return 85;
    case "validating":
      return 92;
    case "ready":
      return 100;
    case "failed":
      return 0;
    default:
      return 0;
  }
}

async function persistProgress(
  job: PipelineJob,
  deps: FigurineStageDeps,
  patch: {
    phase: FigurinePhase;
    progress?: number;
    providerTaskId?: string;
    failureCode?: string;
    failureMessage?: string;
  }
): Promise<void> {
  if (!job.lockToken) return;
  const patchProgress = deps.patchProgress ?? patchRunningJobResult;
  await patchProgress({
    jobId: job.id,
    lockToken: job.lockToken,
    result: {
      ...(job.result ?? {}),
      provider: FIGURINE_PROVIDER,
      phase: patch.phase,
      progress: patch.progress ?? phaseProgress(patch.phase),
      ...(patch.providerTaskId ? { providerTaskId: patch.providerTaskId } : {}),
      ...(patch.failureCode ? { failureCode: patch.failureCode } : {}),
      ...(patch.failureMessage ? { failureMessage: patch.failureMessage } : {})
    },
    refreshLock: true
  });
}

function mergeSubject(
  subjects: FigurineSubjectRecord[] | undefined,
  next: FigurineSubjectRecord
): FigurineSubjectRecord[] {
  const list = subjects ? [...subjects] : [];
  const idx = list.findIndex((s) => s.id === next.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  return list.slice(0, 3);
}

/**
 * Run figurine_build for a claimed job.
 * Persists providerTaskId before polling; reuses it on reclaim.
 */
export async function runFigurineBuildStage(
  job: PipelineJob,
  deps: FigurineStageDeps
): Promise<FigurineStageResult> {
  if (!job.lockToken) {
    throw new FigurineBuildError("Claimed job is missing lockToken", {
      retryable: false,
      code: "MISSING_LOCK"
    });
  }
  const lockToken = job.lockToken;

  const loadProject = deps.loadProject ?? getProjectRecord;
  const loadSource = deps.loadSource ?? downloadSourceFile;
  const complete = deps.complete ?? completeJob;
  const markProject = deps.markProject ?? markProjectStatus;
  const nowMs = deps.nowMs ?? Date.now;
  const sleep = deps.sleep ?? sleepMs;
  const pollIntervalMs = deps.pollIntervalMs ?? 2_000;
  const providerTimeoutMs = deps.providerTimeoutMs ?? FIGURINE_PROVIDER_TIMEOUT_MS;

  const project = await loadProject(job.projectId);
  if (project.mode !== "figurine_3d") {
    throw new FigurineBuildError("Project mode is not figurine_3d", {
      retryable: false,
      code: "WRONG_MODE"
    });
  }

  const sourceFileId = project.sourceImagePath;
  const sourceBytes = sourceFileId ? await loadSource(sourceFileId) : null;
  assertFigurineInputs({
    projectId: job.projectId,
    inputHash: job.inputHash,
    sourceFileId,
    sourceBytes
  });

  const mime = detectFigurineImageMime(sourceBytes!);
  if (!mime) {
    throw new FigurineBuildError("Figurine subject must be PNG or JPEG", {
      retryable: false,
      code: "UNSUPPORTED_IMAGE"
    });
  }

  const inspection = await (deps.inspectSubject ?? inspectFigurineSubject)(sourceBytes!);
  assertFigurineSubjectSuitable({
    bytes: sourceBytes!,
    width: inspection.width,
    height: inspection.height,
    coverage: inspection.coverage,
    componentCount: inspection.componentCount
  });

  const artifactKey = figurineArtifactKey(job.projectId, job.inputHash);
  const existing = await deps.storage.getMetadata(artifactKey);
  const existingProviderTaskId =
    typeof job.result?.providerTaskId === "string" ? job.result.providerTaskId : "";

  if (existing && typeof existing.checksum === "string" && existing.checksum) {
    const publicUrl = deps.storage.getPublicUrl(artifactKey);
    const subjectId =
      typeof job.result?.subjectId === "string" ? job.result.subjectId : "primary";
    await complete({
      jobId: job.id,
      lockToken,
      artifactHash: existing.checksum,
      result: {
        kind: "figurine.glb",
        publicUrl,
        artifactKey,
        provider: FIGURINE_PROVIDER,
        providerTaskId: existingProviderTaskId || undefined,
        phase: "ready",
        progress: 100,
        pipeline: figurinePipelineLabel(),
        subjectId,
        idempotent: true
      }
    });
    await markProject(job.projectId, "ready", {
      figurineModelUrl: publicUrl,
      figurineSubjects: mergeSubject(project.settings.figurineSubjects, {
        id: subjectId,
        sourceFileId: sourceFileId!,
        status: "ready",
        progress: 100,
        provider: FIGURINE_PROVIDER,
        providerTaskId: existingProviderTaskId || undefined,
        jobId: job.id,
        modelUrl: publicUrl,
        artifactHash: existing.checksum
      })
    });
    return {
      kind: "idempotent",
      artifactKey,
      artifactHash: existing.checksum,
      publicUrl,
      providerTaskId: existingProviderTaskId || "cached",
      rawBytes: existing.size ?? 0,
      optimizedBytes: existing.size ?? 0
    };
  }

  if (!isTripoConfigured() && !deps.provider) {
    throw new FigurineBuildError("Configurarea 3D nu este disponibilă încă", {
      retryable: false,
      code: "TRIPO_CONFIG_MISSING"
    });
  }

  const provider =
    deps.provider ?? createTripoProvider(requireTripoConfig());

  let providerTaskId = existingProviderTaskId;
  const subjectId =
    typeof job.result?.subjectId === "string" ? job.result.subjectId : "primary";

  if (!providerTaskId) {
    await persistProgress(job, deps, { phase: "submitting", progress: 5 });
    const uploaded = await provider.uploadImage({
      bytes: sourceBytes!,
      filename: mime === "image/png" ? "subject.png" : "subject.jpg",
      contentType: mime
    });
    const submitted = await provider.submitImageToModel({ fileToken: uploaded.fileToken });
    providerTaskId = submitted.providerTaskId;
    // Persist immediately so reclaim/retry does not create a second paid task.
    await persistProgress(job, deps, {
      phase: "provider_queued",
      progress: 10,
      providerTaskId
    });
    job = {
      ...job,
      result: {
        ...(job.result ?? {}),
        providerTaskId,
        phase: "provider_queued",
        progress: 10,
        subjectId
      }
    };
  }

  const deadline = nowMs() + providerTimeoutMs;
  let snapshot = await provider.getTask(providerTaskId);
  while (snapshot.status === "queued" || snapshot.status === "running" || snapshot.status === "unknown") {
    if (nowMs() > deadline) {
      throw new FigurineBuildError("Tripo generation timed out", {
        retryable: true,
        code: "TRIPO_TIMEOUT"
      });
    }
    const phase: FigurinePhase =
      snapshot.status === "queued" ? "provider_queued" : "provider_running";
    await persistProgress(job, deps, {
      phase,
      progress: phaseProgress(phase, snapshot.progress),
      providerTaskId
    });
    await sleep(pollIntervalMs);
    snapshot = await provider.getTask(providerTaskId);
  }

  if (snapshot.status !== "success" || !snapshot.modelUrl) {
    throw new FigurineBuildError(
      snapshot.errorMessage || `Tripo task ended with status ${snapshot.status}`,
      {
        retryable: false,
        code: snapshot.errorCode || "TRIPO_FAILED"
      }
    );
  }

  await persistProgress(job, deps, {
    phase: "downloading",
    progress: 85,
    providerTaskId
  });
  const downloaded = await provider.downloadModel(snapshot.modelUrl);
  if (!downloaded.byteLength) {
    throw new FigurineBuildError("Tripo model download was empty", {
      retryable: false,
      code: "TRIPO_DOWNLOAD_EMPTY"
    });
  }
  if (downloaded.byteLength > FIGURINE_MAX_GLB_BYTES) {
    throw new FigurineBuildError("Figurine GLB exceeds maximum size", {
      retryable: false,
      code: "GLB_TOO_LARGE"
    });
  }

  await persistProgress(job, deps, {
    phase: "validating",
    progress: 92,
    providerTaskId
  });
  await validateFigurineGlb(downloaded);

  const { bytes: optimized, report } = await optimizeGlb(downloaded);
  await validateFigurineGlb(optimized);

  const contentChecksum = sha256Hex(optimized);
  const artifactHash = computeArtifactHash({
    inputHash: job.inputHash,
    artifactKind: "figurine.glb",
    contentChecksum
  });

  await deps.storage.write({
    key: artifactKey,
    body: optimized,
    contentType: "model/gltf-binary",
    cacheControl: "public, max-age=31536000, immutable",
    checksum: artifactHash
  });
  const meta = await deps.storage.getMetadata(artifactKey);
  if (!meta || meta.checksum !== artifactHash) {
    throw new FigurineBuildError("Public figurine artifact verify failed after write", {
      retryable: true,
      code: "ARTIFACT_VERIFY"
    });
  }

  const publicUrl = deps.storage.getPublicUrl(artifactKey);
  // Guard: never claim source-bucket paths as public.
  if (/source-drawings|\/api\/files\//i.test(publicUrl)) {
    throw new FigurineBuildError("Refusing to publish figurine from private source storage", {
      retryable: false,
      code: "PRIVATE_STORAGE"
    });
  }

  await complete({
    jobId: job.id,
    lockToken,
    artifactHash,
    result: {
      kind: "figurine.glb",
      publicUrl,
      artifactKey,
      provider: FIGURINE_PROVIDER,
      providerTaskId,
      phase: "ready",
      progress: 100,
      pipeline: figurinePipelineLabel(),
      subjectId,
      rawBytes: report.rawBytes,
      optimizedBytes: report.optimizedBytes,
      operations: report.operations
    }
  });

  await markProject(job.projectId, "ready", {
    figurineModelUrl: publicUrl,
    figurineSubjects: mergeSubject(project.settings.figurineSubjects, {
      id: subjectId,
      sourceFileId: sourceFileId!,
      label: "Personaj",
      status: "ready",
      progress: 100,
      provider: FIGURINE_PROVIDER,
      providerTaskId,
      jobId: job.id,
      modelUrl: publicUrl,
      artifactHash
    })
  });

  return {
    kind: "written",
    artifactKey,
    artifactHash,
    publicUrl,
    providerTaskId,
    rawBytes: report.rawBytes,
    optimizedBytes: report.optimizedBytes
  };
}

export async function handleFigurineJobFailure(
  job: PipelineJob,
  error: unknown
): Promise<void> {
  if (!job.lockToken) return;
  const retryable =
    error instanceof FigurineBuildError
      ? error.retryable
      : error instanceof PublicStorageConfigError
        ? false
        : true;
  const code =
    error instanceof FigurineBuildError
      ? error.code
      : error instanceof PublicStorageConfigError
        ? "PUBLIC_STORAGE"
        : "FIGURINE_UNKNOWN";
  const message =
    error instanceof Error ? error.message : "Figurină 3D generation failed";

  try {
    await patchRunningJobResult({
      jobId: job.id,
      lockToken: job.lockToken,
      result: {
        ...(job.result ?? {}),
        provider: FIGURINE_PROVIDER,
        phase: "failed",
        progress: 0,
        failureCode: code,
        failureMessage: message.slice(0, 400)
      }
    });
  } catch {
    // lock may already be lost
  }

  await failJob({
    jobId: job.id,
    lockToken: job.lockToken,
    error: `[${code}] ${message}`,
    terminal: !retryable
  });

  try {
    const project = await getProjectRecord(job.projectId);
    const subjectId =
      typeof job.result?.subjectId === "string" ? job.result.subjectId : "primary";
    await markProjectStatus(job.projectId, "error", {
      figurineSubjects: mergeSubject(project.settings.figurineSubjects, {
        id: subjectId,
        sourceFileId: project.sourceImagePath || "",
        status: "failed",
        progress: 0,
        provider: FIGURINE_PROVIDER,
        providerTaskId:
          typeof job.result?.providerTaskId === "string"
            ? job.result.providerTaskId
            : undefined,
        jobId: job.id,
        failureCode: code,
        failureMessage: message.slice(0, 400)
      })
    });
  } catch {
    // best-effort project status
  }
}
