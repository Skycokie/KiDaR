import { ID, Permission, Query, Role, type Models } from "node-appwrite";
import {
  JOB_LOCK_TTL_MS,
  JOB_MAX_ATTEMPTS,
  applyJobTransition,
  isEligibleToClaim,
  isIdempotentHit,
  isJobStatus,
  isJobType,
  parsePageRenderDependsOn,
  truncateJobError,
  type JobResult,
  type JobType,
  type PipelineJob
} from "@kidar/core";
import { APPWRITE_DATABASE_ID, APPWRITE_JOBS_COLLECTION } from "./config";
import { createAdminClient } from "./client";

/**
 * Appwrite job persistence (M4.1).
 *
 * Free-plan `jobs` collection attribute budget is exhausted after claim fields
 * (attempt, max_attempts, next_run_at, locked_at, lock_token). Remaining model
 * fields are stored inside the existing `payload` JSON:
 *   { source?, input_hash, artifact_hash?, last_error?, result?, ... }
 *
 * Claim strategy (no SQL CAS):
 * 1. List eligible queued / stale-running candidates.
 * 2. Write status=running with a fresh lock_token (API key / admin client).
 * 3. Re-read the document; keep the claim only if lock_token still matches.
 *
 * Residual risk: two workers may briefly race; the loser aborts after re-read.
 * This is at-least-once delivery — artifact writes must be idempotent.
 * Do not treat this as exactly-once execution.
 */

type JobPayloadBag = {
  source?: string;
  input_hash?: string;
  artifact_hash?: string | null;
  last_error?: string | null;
  result?: JobResult | null;
  [key: string]: unknown;
};

function ownerPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))
  ];
}

function parsePayloadBag(value: unknown): JobPayloadBag {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JobPayloadBag;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JobPayloadBag;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function mapJobDocument(doc: Models.Document): PipelineJob {
  const data = doc as Models.Document & Record<string, unknown>;
  const bag = parsePayloadBag(data.payload);
  const typeRaw = String(data.step ?? "");
  const statusRaw = String(data.status ?? "queued");
  if (!isJobType(typeRaw)) {
    throw new Error(`Unknown job type in document ${doc.$id}: ${typeRaw}`);
  }
  if (!isJobStatus(statusRaw)) {
    throw new Error(`Unknown job status in document ${doc.$id}: ${statusRaw}`);
  }
  return {
    id: doc.$id,
    projectId: String(data.project_id),
    type: typeRaw,
    status: statusRaw,
    attempt: Number(data.attempt ?? 0),
    maxAttempts: Number(data.max_attempts ?? JOB_MAX_ATTEMPTS),
    nextRunAt: (data.next_run_at as string | null) ?? null,
    lockedAt: (data.locked_at as string | null) ?? null,
    lockToken: (data.lock_token as string | null) ?? null,
    lastError: (bag.last_error as string | null) ?? null,
    inputHash: String(bag.input_hash ?? ""),
    artifactHash: (bag.artifact_hash as string | null) ?? null,
    result: (bag.result as JobResult | null) ?? null,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
    dependsOn: parsePageRenderDependsOn(bag.dependsOn)
  };
}

function buildPayloadString(
  job: Pick<PipelineJob, "inputHash" | "artifactHash" | "lastError" | "result">,
  extra: Record<string, unknown> = {}
): string {
  const bag: JobPayloadBag = {
    ...extra,
    input_hash: job.inputHash,
    artifact_hash: job.artifactHash,
    last_error: job.lastError,
    result: job.result
  };
  return JSON.stringify(bag);
}

function toDocumentData(
  job: PipelineJob,
  extraPayload: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    project_id: job.projectId,
    step: job.type,
    status: job.status,
    attempt: job.attempt,
    max_attempts: job.maxAttempts,
    next_run_at: job.nextRunAt,
    locked_at: job.lockedAt,
    lock_token: job.lockToken,
    payload: buildPayloadString(job, extraPayload)
  };
}

export async function findJobByInputHash(params: {
  projectId: string;
  type: JobType;
  inputHash: string;
}): Promise<PipelineJob | null> {
  const { databases } = createAdminClient();
  // input_hash lives in payload JSON — filter in process after project/type query.
  const result = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    [
      Query.equal("project_id", params.projectId),
      Query.equal("step", params.type),
      Query.orderDesc("$createdAt"),
      Query.limit(50)
    ]
  );
  const mapped = result.documents
    .map(mapJobDocument)
    .filter((job) => job.inputHash === params.inputHash);
  if (!mapped.length) return null;
  return (
    mapped.find((job) => job.status === "done") ??
    mapped.find((job) => job.status === "running" || job.status === "queued") ??
    mapped[0]
  );
}

export type EnqueueJobResult =
  | { kind: "created"; job: PipelineJob }
  | { kind: "existing"; job: PipelineJob }
  | { kind: "idempotent_done"; job: PipelineJob };

/**
 * Enqueue idempotently for project/type/inputHash.
 * Returns an existing done job as idempotent success when the hash matches.
 */
export async function enqueueJob(params: {
  projectId: string;
  type: JobType;
  inputHash: string;
  ownerId: string;
  payload?: Record<string, unknown>;
}): Promise<EnqueueJobResult> {
  const existing = await findJobByInputHash({
    projectId: params.projectId,
    type: params.type,
    inputHash: params.inputHash
  });

  if (existing && isIdempotentHit(existing, params.inputHash)) {
    return { kind: "idempotent_done", job: existing };
  }
  if (existing && (existing.status === "queued" || existing.status === "running")) {
    return { kind: "existing", job: existing };
  }

  const now = new Date().toISOString();
  const draft: PipelineJob = {
    id: "",
    projectId: params.projectId,
    type: params.type,
    status: "queued",
    attempt: 0,
    maxAttempts: JOB_MAX_ATTEMPTS,
    nextRunAt: now,
    lockedAt: null,
    lockToken: null,
    lastError: null,
    inputHash: params.inputHash,
    artifactHash: null,
    result: null,
    createdAt: now,
    updatedAt: now
  };

  const { databases } = createAdminClient();
  const created = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    ID.unique(),
    toDocumentData(draft, params.payload ?? { source: "studio" }),
    ownerPermissions(params.ownerId)
  );
  return { kind: "created", job: mapJobDocument(created) };
}

async function listClaimCandidates(nowIso: string, limit = 10): Promise<PipelineJob[]> {
  const { databases } = createAdminClient();
  const queued = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    [
      Query.equal("status", "queued"),
      Query.lessThanEqual("next_run_at", nowIso),
      Query.orderAsc("next_run_at"),
      Query.limit(limit)
    ]
  );

  const lockCutoff = new Date(Date.parse(nowIso) - JOB_LOCK_TTL_MS).toISOString();
  const stale = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    [
      Query.equal("status", "running"),
      Query.lessThanEqual("locked_at", lockCutoff),
      Query.orderAsc("locked_at"),
      Query.limit(limit)
    ]
  );

  return [...queued.documents, ...stale.documents].map(mapJobDocument);
}

/**
 * Claim one eligible job. Returns null when none available or races are lost.
 */
export async function claimNextJob(nowMs = Date.now()): Promise<PipelineJob | null> {
  const { databases } = createAdminClient();
  const nowIso = new Date(nowMs).toISOString();
  const candidates = await listClaimCandidates(nowIso);

  for (const candidate of candidates) {
    if (!isEligibleToClaim(candidate, nowMs)) continue;

    const lockToken = ID.unique();
    const transitioned = applyJobTransition(candidate, {
      action: "claim",
      lockToken,
      at: nowIso
    });

    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_JOBS_COLLECTION,
      candidate.id,
      {
        status: transitioned.status,
        attempt: transitioned.attempt,
        locked_at: transitioned.lockedAt,
        lock_token: transitioned.lockToken,
        next_run_at: transitioned.nextRunAt
      }
    );

    const refreshed = mapJobDocument(
      await databases.getDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_JOBS_COLLECTION,
        candidate.id
      )
    );

    if (refreshed.lockToken !== lockToken || refreshed.status !== "running") {
      continue;
    }
    return refreshed;
  }

  return null;
}

export async function completeJob(params: {
  jobId: string;
  lockToken: string;
  artifactHash?: string;
  result?: JobResult;
}): Promise<PipelineJob> {
  const { databases } = createAdminClient();
  const current = mapJobDocument(
    await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_JOBS_COLLECTION, params.jobId)
  );
  const next = applyJobTransition(current, {
    action: "complete",
    lockToken: params.lockToken,
    artifactHash: params.artifactHash,
    result: params.result
  });
  const existingBag = parsePayloadBag(
    (
      await databases.getDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_JOBS_COLLECTION,
        params.jobId
      )
    ).payload
  );
  const { input_hash: _ih, artifact_hash: _ah, last_error: _le, result: _r, ...extra } =
    existingBag;
  const updated = await databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    params.jobId,
    {
      status: next.status,
      locked_at: null,
      lock_token: null,
      payload: buildPayloadString(next, extra)
    }
  );
  return mapJobDocument(updated);
}

export async function failJob(params: {
  jobId: string;
  lockToken: string;
  error: string;
  nowMs?: number;
}): Promise<PipelineJob> {
  const { databases } = createAdminClient();
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  const currentDoc = await databases.getDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    params.jobId
  );
  const current = mapJobDocument(currentDoc);
  if (current.lockToken !== params.lockToken) {
    throw new Error("Lock token mismatch on fail");
  }
  const next = applyJobTransition(current, {
    action: "fail",
    lockToken: params.lockToken,
    error: truncateJobError(params.error),
    at: nowIso
  });
  const existingBag = parsePayloadBag(currentDoc.payload);
  const { input_hash: _ih, artifact_hash: _ah, last_error: _le, result: _r, ...extra } =
    existingBag;
  const updated = await databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_JOBS_COLLECTION,
    params.jobId,
    {
      status: next.status,
      locked_at: null,
      lock_token: null,
      next_run_at: next.nextRunAt,
      payload: buildPayloadString(next, extra)
    }
  );
  return mapJobDocument(updated);
}
