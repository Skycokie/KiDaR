import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  PopoutBuildError,
  PublicStorageConfigError,
  assertPopoutInputs,
  popoutArtifactKey,
  popoutPipelineLabel,
  type PublicArtifactStorage,
  type PipelineJob
} from "@kidar/core";
import { computeArtifactHash, sha256Hex } from "@kidar/core/hash";
import { completeJob, downloadSourceFile, failJob, getProjectSource } from "../appwrite/jobs";
import { buildPopoutGlb, isGlbBuffer } from "./build-glb";
import { createCutoutFromRgba, type CutoutResult } from "./cutout-rgba";
import { optimizeGlb } from "./optimize";

export type PopoutStageDeps = {
  storage: PublicArtifactStorage;
  loadSource?: (fileId: string) => Promise<Uint8Array>;
  loadProject?: (projectId: string) => Promise<{
    sourceImagePath: string | null;
    mode: string;
    settingsRaw: string;
  }>;
  cutout?: (bytes: Uint8Array) => Promise<CutoutResult>;
  complete?: typeof completeJob;
  fail?: typeof failJob;
};

export type PopoutStageResult = {
  kind: "written" | "idempotent";
  artifactKey: string;
  artifactHash: string;
  publicUrl: string;
  rawBytes: number;
  optimizedBytes: number;
  operations: string[];
  coverage: number;
};

function parseTheme(settingsRaw: string): string {
  try {
    const parsed = JSON.parse(settingsRaw) as { theme?: string };
    return parsed.theme || "#6d5dfc";
  } catch {
    return "#6d5dfc";
  }
}

/**
 * Run popout_build for a claimed job.
 * Does not mark done unless public artifact persistence verifies.
 */
export async function runPopoutBuildStage(
  job: PipelineJob,
  deps: PopoutStageDeps
): Promise<PopoutStageResult> {
  if (!job.lockToken) {
    throw new PopoutBuildError("Claimed job is missing lockToken", {
      retryable: false,
      code: "MISSING_LOCK"
    });
  }

  const loadProject = deps.loadProject ?? getProjectSource;
  const loadSource = deps.loadSource ?? downloadSourceFile;
  const cutout =
    deps.cutout ??
    (async (bytes: Uint8Array) => {
      const { createCutoutFromBytes } = await import("./cutout-node");
      return createCutoutFromBytes(bytes);
    });
  const complete = deps.complete ?? completeJob;

  const project = await loadProject(job.projectId);
  const sourceBytes = project.sourceImagePath
    ? await loadSource(project.sourceImagePath)
    : null;

  assertPopoutInputs({
    projectId: job.projectId,
    inputHash: job.inputHash,
    sourceFileId: project.sourceImagePath,
    sourceBytes
  });

  const artifactKey = popoutArtifactKey(job.projectId, job.inputHash);
  const existing = await deps.storage.getMetadata(artifactKey);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "kidar-popout-"));
  try {
    const cut = await cutout(sourceBytes!);
    const rawGlb = await buildPopoutGlb({
      polygons: cut.polygons,
      width: cut.width,
      height: cut.height,
      rgba: cut.rgba,
      theme: parseTheme(project.settingsRaw)
    });
    if (!isGlbBuffer(rawGlb) || rawGlb.byteLength === 0) {
      throw new PopoutBuildError("Generated GLB is empty or invalid", {
        retryable: false,
        code: "INVALID_GLB"
      });
    }

    const { bytes: optimized, report } = await optimizeGlb(rawGlb);
    if (!isGlbBuffer(optimized) || optimized.byteLength === 0) {
      throw new PopoutBuildError("Optimized GLB is empty or invalid", {
        retryable: false,
        code: "INVALID_OPTIMIZED_GLB"
      });
    }

    const artifactHash = computeArtifactHash({
      inputHash: job.inputHash,
      artifactKind: "popout.glb",
      contentChecksum: sha256Hex(optimized)
    });

    await writeFile(path.join(tempRoot, "popout.glb"), optimized);

    if (existing?.checksum && existing.checksum === artifactHash) {
      await complete({
        jobId: job.id,
        lockToken: job.lockToken,
        artifactHash,
        result: {
          artifactKey,
          publicUrl: deps.storage.getPublicUrl(artifactKey),
          idempotent: true,
          pipeline: popoutPipelineLabel(),
          rawBytes: report.rawBytes,
          optimizedBytes: report.optimizedBytes,
          operations: report.operations,
          coverage: cut.stats.coverage
        }
      });
      return {
        kind: "idempotent",
        artifactKey,
        artifactHash,
        publicUrl: deps.storage.getPublicUrl(artifactKey),
        rawBytes: report.rawBytes,
        optimizedBytes: report.optimizedBytes,
        operations: report.operations,
        coverage: cut.stats.coverage
      };
    }

    const written = await deps.storage.write({
      key: artifactKey,
      body: optimized,
      contentType: "model/gltf-binary",
      checksum: artifactHash,
      cacheControl: "public, max-age=31536000, immutable"
    });

    const verified = await deps.storage.getMetadata(artifactKey);
    if (!verified || verified.checksum !== artifactHash) {
      throw new PopoutBuildError("Public artifact verification failed after write", {
        retryable: true,
        code: "VERIFY_FAILED"
      });
    }

    await complete({
      jobId: job.id,
      lockToken: job.lockToken,
      artifactHash,
      result: {
        artifactKey,
        publicUrl: written.publicUrl,
        idempotent: false,
        pipeline: popoutPipelineLabel(),
        rawBytes: report.rawBytes,
        optimizedBytes: report.optimizedBytes,
        operations: report.operations,
        coverage: cut.stats.coverage
      }
    });

    return {
      kind: "written",
      artifactKey,
      artifactHash,
      publicUrl: written.publicUrl,
      rawBytes: report.rawBytes,
      optimizedBytes: report.optimizedBytes,
      operations: report.operations,
      coverage: cut.stats.coverage
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function handlePopoutJobFailure(
  job: PipelineJob,
  error: unknown,
  fail: typeof failJob = failJob
): Promise<void> {
  if (!job.lockToken) return;
  const message = error instanceof Error ? error.message : String(error);
  const nonRetryable =
    (error instanceof PopoutBuildError && !error.retryable) ||
    error instanceof PublicStorageConfigError;
  await fail({
    jobId: job.id,
    lockToken: job.lockToken,
    error: message,
    terminal: nonRetryable
  });
}

export { createCutoutFromRgba };
export type { CutoutResult };
