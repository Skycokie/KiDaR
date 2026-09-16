import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MindCompileError,
  PublicStorageConfigError,
  assertMindArtifactBytes,
  assertMindCompileInputs,
  assertSupportedSourceImage,
  mindArtifactKey,
  mindPipelineLabel,
  type PublicArtifactStorage,
  type PipelineJob
} from "@kidar/core";
import { computeArtifactHash, sha256Hex } from "@kidar/core/hash";
import { completeJob, downloadSourceFile, failJob, getProjectSource } from "../appwrite/jobs";
import { compileTargetsMind } from "./compile";

export type MindCompileStageDeps = {
  storage: PublicArtifactStorage;
  loadSource?: (fileId: string) => Promise<Uint8Array>;
  loadProject?: (projectId: string) => Promise<{
    sourceImagePath: string | null;
    mode: string;
    settingsRaw: string;
  }>;
  compile?: (bytes: Uint8Array) => Promise<Uint8Array>;
  complete?: typeof completeJob;
  fail?: typeof failJob;
};

export type MindCompileStageResult = {
  kind: "written" | "idempotent";
  artifactKey: string;
  artifactHash: string;
  publicUrl: string;
  mindBytes: number;
  contentSha256: string;
};

/**
 * Run mind_compile for a claimed job.
 * Does not mark done unless public artifact persistence verifies.
 */
export async function runMindCompileStage(
  job: PipelineJob,
  deps: MindCompileStageDeps
): Promise<MindCompileStageResult> {
  if (!job.lockToken) {
    throw new MindCompileError("Claimed job is missing lockToken", {
      retryable: false,
      code: "MISSING_LOCK"
    });
  }

  const loadProject = deps.loadProject ?? getProjectSource;
  const loadSource = deps.loadSource ?? downloadSourceFile;
  const compile = deps.compile ?? compileTargetsMind;
  const complete = deps.complete ?? completeJob;

  const project = await loadProject(job.projectId);
  const sourceBytes = project.sourceImagePath
    ? await loadSource(project.sourceImagePath)
    : null;

  assertMindCompileInputs({
    projectId: job.projectId,
    inputHash: job.inputHash,
    sourceFileId: project.sourceImagePath,
    sourceBytes
  });
  assertSupportedSourceImage(sourceBytes!);

  const artifactKey = mindArtifactKey(job.projectId, job.inputHash);
  const existing = await deps.storage.getMetadata(artifactKey);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "kidar-mind-"));
  try {
    const mindBytes = assertMindArtifactBytes(await compile(sourceBytes!));
    const contentSha256 = sha256Hex(mindBytes);
    const artifactHash = computeArtifactHash({
      inputHash: job.inputHash,
      artifactKind: "targets.mind",
      contentChecksum: contentSha256
    });

    await writeFile(path.join(tempRoot, "targets.mind"), mindBytes);

    if (existing?.checksum && existing.checksum === artifactHash) {
      await complete({
        jobId: job.id,
        lockToken: job.lockToken,
        artifactHash,
        result: {
          artifactKey,
          publicUrl: deps.storage.getPublicUrl(artifactKey),
          idempotent: true,
          pipeline: mindPipelineLabel(),
          mindBytes: mindBytes.byteLength,
          contentSha256
        }
      });
      return {
        kind: "idempotent",
        artifactKey,
        artifactHash,
        publicUrl: deps.storage.getPublicUrl(artifactKey),
        mindBytes: mindBytes.byteLength,
        contentSha256
      };
    }

    const written = await deps.storage.write({
      key: artifactKey,
      body: mindBytes,
      contentType: "application/octet-stream",
      checksum: artifactHash,
      cacheControl: "public, max-age=31536000, immutable"
    });

    const verified = await deps.storage.getMetadata(artifactKey);
    if (!verified || verified.checksum !== artifactHash) {
      throw new MindCompileError("Public artifact verification failed after write", {
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
        pipeline: mindPipelineLabel(),
        mindBytes: mindBytes.byteLength,
        contentSha256
      }
    });

    return {
      kind: "written",
      artifactKey,
      artifactHash,
      publicUrl: written.publicUrl,
      mindBytes: mindBytes.byteLength,
      contentSha256
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function handleMindJobFailure(
  job: PipelineJob,
  error: unknown,
  fail: typeof failJob = failJob
): Promise<void> {
  if (!job.lockToken) return;
  const message = error instanceof Error ? error.message : String(error);
  const nonRetryable =
    (error instanceof MindCompileError && !error.retryable) ||
    error instanceof PublicStorageConfigError;
  await fail({
    jobId: job.id,
    lockToken: job.lockToken,
    error: message,
    terminal: nonRetryable
  });
}
