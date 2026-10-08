import {
  PublicStorageConfigError,
  isAllowedUnpublishKey,
  normalizePublicObjectKey,
  type PipelineJob
} from "@kidar/core";
import { completeJob, failJob, getJobPayloadBag } from "../appwrite/jobs";
import { deletePublicArtifactKeys } from "../storage/public";

export class UnpublishError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "UnpublishError";
    this.retryable = options?.retryable ?? true;
  }
}

export type UnpublishStageDeps = {
  loadPayload?: typeof getJobPayloadBag;
  deleteKeys?: typeof deletePublicArtifactKeys;
  complete?: typeof completeJob;
};

function parseKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) continue;
    try {
      const key = normalizePublicObjectKey(item);
      if (isAllowedUnpublishKey(key)) keys.push(key);
    } catch {
      // skip malformed
    }
  }
  return [...new Set(keys)];
}

export async function runUnpublishStage(
  job: PipelineJob,
  deps: UnpublishStageDeps = {}
): Promise<{ deleted: string[]; skipped: string[] }> {
  if (!job.lockToken) {
    throw new UnpublishError("Claimed job is missing lockToken", { retryable: false });
  }
  const loadPayload = deps.loadPayload ?? getJobPayloadBag;
  const deleteKeys = deps.deleteKeys ?? deletePublicArtifactKeys;
  const complete = deps.complete ?? completeJob;

  const bag = await loadPayload(job.id);
  const keys = parseKeys(bag.keys);
  if (!keys.length) {
    throw new UnpublishError("Unpublish job missing allow-listed keys", { retryable: false });
  }

  const result = await deleteKeys(keys);
  await complete({
    jobId: job.id,
    lockToken: job.lockToken,
    result: {
      deleted: result.deleted,
      skipped: result.skipped,
      slug: typeof bag.slug === "string" ? bag.slug : null
    }
  });
  return result;
}

export async function handleUnpublishJobFailure(
  job: PipelineJob,
  error: unknown,
  fail: typeof failJob = failJob
): Promise<void> {
  if (!job.lockToken) return;
  const message = error instanceof Error ? error.message : String(error);
  const nonRetryable =
    (error instanceof UnpublishError && !error.retryable) ||
    error instanceof PublicStorageConfigError;
  await fail({
    jobId: job.id,
    lockToken: job.lockToken,
    error: message,
    terminal: nonRetryable
  });
}
