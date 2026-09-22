/**
 * figurine_build worker stage — Tripo image-to-3D → retopo → validate → R2 public GLB.
 * Go D: never accept the high-poly generation GLB; only the mesh/decimate output.
 */

import {
  FIGURINE_MAX_GLB_BYTES,
  FIGURINE_PROVIDER,
  FIGURINE_PROVIDER_TIMEOUT_MS,
  FIGURINE_RETOPO_FACE_LIMIT,
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
  type TripoImageToModelProvider,
  type TripoTaskSnapshot
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
  retopoTaskId: string;
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
      return Math.max(15, Math.min(55, providerProgress ?? 15));
    case "retopologizing":
      return Math.max(60, Math.min(82, 60 + Math.round((providerProgress ?? 0) * 0.22)));
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
    retopoTaskId?: string;
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
      ...(patch.retopoTaskId ? { retopoTaskId: patch.retopoTaskId } : {}),
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

async function pollTripoTask(input: {
  provider: TripoImageToModelProvider;
  taskId: string;
  job: PipelineJob;
  deps: FigurineStageDeps;
  phaseForQueued: FigurinePhase;
  phaseForRunning: FigurinePhase;
  providerTaskId: string;
  retopoTaskId?: string;
  timeoutMs: number;
  nowMs: () => number;
  sleep: (ms: number) => Promise<void>;
  pollIntervalMs: number;
  timeoutCode: string;
  failedCode: string;
  /** Generation may succeed without a durable URL; retopo download requires one. */
  requireModelUrl?: boolean;
}): Promise<TripoTaskSnapshot> {
  const deadline = input.nowMs() + input.timeoutMs;
  let snapshot = await input.provider.getTask(input.taskId);
  while (
    snapshot.status === "queued" ||
    snapshot.status === "running" ||
    snapshot.status === "unknown"
  ) {
    if (input.nowMs() > deadline) {
      throw new FigurineBuildError("Tripo task timed out", {
        retryable: true,
        code: input.timeoutCode
      });
    }
    const phase =
      snapshot.status === "queued" ? input.phaseForQueued : input.phaseForRunning;
    await persistProgress(input.job, input.deps, {
      phase,
      progress: phaseProgress(phase, snapshot.progress),
      providerTaskId: input.providerTaskId,
      retopoTaskId: input.retopoTaskId
    });
    await input.sleep(input.pollIntervalMs);
    snapshot = await input.provider.getTask(input.taskId);
  }
  if (snapshot.status !== "success") {
    throw new FigurineBuildError(
      snapshot.errorMessage || `Tripo task ended with status ${snapshot.status}`,
      {
        retryable: false,
        code: snapshot.errorCode || input.failedCode
      }
    );
  }
  if (input.requireModelUrl !== false && !snapshot.modelUrl) {
    throw new FigurineBuildError(
      snapshot.errorMessage || "Tripo task succeeded without a model URL",
      {
        retryable: false,
        code: snapshot.errorCode || input.failedCode
      }
    );
  }
  return snapshot;
}

/**
 * Run figurine_build for a claimed job.
 * Persists providerTaskId + retopoTaskId before polling; reuses them on reclaim.
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
  const existingRetopoTaskId =
    typeof job.result?.retopoTaskId === "string" ? job.result.retopoTaskId : "";

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
        retopoTaskId: existingRetopoTaskId || undefined,
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
      retopoTaskId: existingRetopoTaskId || "cached",
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

  const provider = deps.provider ?? createTripoProvider(requireTripoConfig());

  let providerTaskId = existingProviderTaskId;
  let retopoTaskId = existingRetopoTaskId;
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
    // Persist immediately so reclaim/retry does not create a second paid Image-to-3D task.
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

  // Wait for high-poly generation — do not download/accept that GLB.
  await pollTripoTask({
    provider,
    taskId: providerTaskId,
    job,
    deps,
    phaseForQueued: "provider_queued",
    phaseForRunning: "provider_running",
    providerTaskId,
    timeoutMs: providerTimeoutMs,
    nowMs,
    sleep,
    pollIntervalMs,
    timeoutCode: "TRIPO_TIMEOUT",
    failedCode: "TRIPO_FAILED",
    requireModelUrl: false
  });

  if (!retopoTaskId) {
    await persistProgress(job, deps, {
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
    // Persist before polling so reclaim does not pay for a second retopo.
    await persistProgress(job, deps, {
      phase: "retopologizing",
      progress: 60,
      providerTaskId,
      retopoTaskId
    });
    job = {
      ...job,
      result: {
        ...(job.result ?? {}),
        providerTaskId,
        retopoTaskId,
        phase: "retopologizing",
        progress: 60,
        subjectId
      }
    };
  }

  const retopoSnapshot = await pollTripoTask({
    provider,
    taskId: retopoTaskId,
    job,
    deps,
    phaseForQueued: "retopologizing",
    phaseForRunning: "retopologizing",
    providerTaskId,
    retopoTaskId,
    timeoutMs: providerTimeoutMs,
    nowMs,
    sleep,
    pollIntervalMs,
    timeoutCode: "TRIPO_RETOPO_TIMEOUT",
    failedCode: "TRIPO_RETOPO_FAILED"
  });

  await persistProgress(job, deps, {
    phase: "downloading",
    progress: 85,
    providerTaskId,
    retopoTaskId
  });
  const downloaded = await provider.downloadModel(retopoSnapshot.modelUrl!);
  if (!downloaded.byteLength) {
    throw new FigurineBuildError("Tripo retopo model download was empty", {
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
    providerTaskId,
    retopoTaskId
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
      retopoTaskId,
      phase: "ready",
      progress: 100,
      pipeline: figurinePipelineLabel(),
      subjectId,
      retopoFaceLimit: FIGURINE_RETOPO_FACE_LIMIT,
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
    retopoTaskId,
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
