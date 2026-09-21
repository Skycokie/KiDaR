import { ID, Query, type Models } from "node-appwrite";
import {
  JOB_LOCK_TTL_MS,
  JOB_MAX_ATTEMPTS,
  JobLockMismatchError,
  applyJobTransition,
  arePageRenderDependenciesSatisfied,
  assertJobLockHeld,
  isEligibleToClaim,
  isJobStatus,
  isJobType,
  pageRenderDeferralIso,
  parsePageRenderDependsOn,
  prioritizeClaimCandidates,
  resolvePageRenderDependsOn,
  selectPageRenderClaimAction,
  truncateJobError,
  type JobResult,
  type PipelineJob
} from "@kidar/core";
import { createWorkerAppwrite } from "./client";

type JobPayloadBag = {
  source?: string;
  input_hash?: string;
  artifact_hash?: string | null;
  last_error?: string | null;
  result?: JobResult | null;
  [key: string]: unknown;
};

function parsePayloadBag(value: unknown): JobPayloadBag {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as JobPayloadBag;
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
  if (!isJobType(typeRaw)) throw new Error(`Unknown job type: ${typeRaw}`);
  if (!isJobStatus(statusRaw)) throw new Error(`Unknown job status: ${statusRaw}`);
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
  return JSON.stringify({
    ...extra,
    input_hash: job.inputHash,
    artifact_hash: job.artifactHash,
    last_error: job.lastError,
    result: job.result
  });
}

async function listClaimCandidates(nowIso: string, limit = 10): Promise<PipelineJob[]> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  const queued = await databases.listDocuments(databaseId, jobsCollection, [
    Query.equal("status", "queued"),
    Query.lessThanEqual("next_run_at", nowIso),
    Query.orderAsc("next_run_at"),
    Query.limit(limit)
  ]);
  const lockCutoff = new Date(Date.parse(nowIso) - JOB_LOCK_TTL_MS).toISOString();
  const stale = await databases.listDocuments(databaseId, jobsCollection, [
    Query.equal("status", "running"),
    Query.lessThanEqual("locked_at", lockCutoff),
    Query.orderAsc("locked_at"),
    Query.limit(limit)
  ]);
  return [...queued.documents, ...stale.documents].map(mapJobDocument);
}

export async function claimNextJob(nowMs = Date.now()): Promise<PipelineJob | null> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  const nowIso = new Date(nowMs).toISOString();
  const candidates = prioritizeClaimCandidates(await listClaimCandidates(nowIso));
  for (const candidate of candidates) {
    if (!isEligibleToClaim(candidate, nowMs)) continue;

    if (candidate.type === "page_render") {
      const claimAction = selectPageRenderClaimAction(candidate, null);
      if (claimAction === "reject_missing_depends_on") {
        await rejectMalformedPageRender(candidate);
        continue;
      }
      try {
        const project = await getProjectRecord(candidate.projectId);
        const siblings = await listJobsForProject(candidate.projectId);
        const dependsOn = resolvePageRenderDependsOn(project.mode, candidate);
        const satisfied = arePageRenderDependenciesSatisfied(dependsOn, siblings);
        if (selectPageRenderClaimAction(candidate, satisfied) === "defer") {
          await deferQueuedJob(candidate.id, pageRenderDeferralIso(nowMs));
          continue;
        }
      } catch {
        continue;
      }
    }

    const lockToken = ID.unique();
    const transitioned = applyJobTransition(candidate, {
      action: "claim",
      lockToken,
      at: nowIso
    });
    await databases.updateDocument(databaseId, jobsCollection, candidate.id, {
      status: transitioned.status,
      attempt: transitioned.attempt,
      locked_at: transitioned.lockedAt,
      lock_token: transitioned.lockToken,
      next_run_at: transitioned.nextRunAt
    });
    const refreshed = mapJobDocument(
      await databases.getDocument(databaseId, jobsCollection, candidate.id)
    );
    if (refreshed.lockToken === lockToken && refreshed.status === "running") {
      return refreshed;
    }
  }
  return null;
}

/**
 * Push an unready queued page_render out of the immediate claim window so
 * upstream popout/mind jobs remain visible to the poller.
 */
async function deferQueuedJob(jobId: string, nextRunAt: string): Promise<void> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  const current = mapJobDocument(await databases.getDocument(databaseId, jobsCollection, jobId));
  if (current.status !== "queued") return;
  await databases.updateDocument(databaseId, jobsCollection, jobId, {
    next_run_at: nextRunAt
  });
}

/** Fail-closed: malformed page_render without dependsOn must not block the queue forever. */
async function rejectMalformedPageRender(job: PipelineJob): Promise<void> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  if (job.status !== "queued") return;
  const bag = parsePayloadBag(
    (await databases.getDocument(databaseId, jobsCollection, job.id)).payload
  );
  const { input_hash: _a, artifact_hash: _b, last_error: _c, result: _d, ...extra } = bag;
  await databases.updateDocument(databaseId, jobsCollection, job.id, {
    status: "error",
    locked_at: null,
    lock_token: null,
    next_run_at: null,
    payload: buildPayloadString(
      {
        inputHash: job.inputHash,
        artifactHash: job.artifactHash,
        lastError: truncateJobError(
          "page_render missing payload.dependsOn.mind_compile (content hash)"
        ),
        result: job.result
      },
      extra
    )
  });
}

export async function completeJob(params: {
  jobId: string;
  lockToken: string;
  artifactHash?: string;
  result?: JobResult;
}): Promise<PipelineJob> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  // Optimistic lock check only: Appwrite updateDocument has no conditional
  // WHERE on lock_token, so this is not atomic CAS. A stale worker can still
  // overwrite between re-read and write; post-write checks detect some losses
  // but cannot roll back a successful blind update. Safe under single-worker.
  const currentDoc = await databases.getDocument(databaseId, jobsCollection, params.jobId);
  const current = mapJobDocument(currentDoc);
  assertJobLockHeld(current, params.lockToken, "complete");
  const next = applyJobTransition(current, {
    action: "complete",
    lockToken: params.lockToken,
    artifactHash: params.artifactHash,
    result: params.result
  });
  const bag = parsePayloadBag(currentDoc.payload);
  const { input_hash: _a, artifact_hash: _b, last_error: _c, result: _d, ...extra } = bag;
  await databases.updateDocument(databaseId, jobsCollection, params.jobId, {
    status: next.status,
    locked_at: null,
    lock_token: null,
    payload: buildPayloadString(next, {
      ...extra,
      completed_by_lock: params.lockToken
    })
  });
  const refreshed = mapJobDocument(
    await databases.getDocument(databaseId, jobsCollection, params.jobId)
  );
  if (refreshed.status !== "done" || refreshed.lockToken !== null) {
    throw new JobLockMismatchError("Complete lost race after write");
  }
  return refreshed;
}

/**
 * Persist progress / providerTaskId while the job remains `running`.
 * Re-reads and asserts lock ownership before write. Optionally refreshes
 * locked_at so long Tripo polls stay within JOB_LOCK_TTL under single-worker.
 */
export async function patchRunningJobResult(params: {
  jobId: string;
  lockToken: string;
  result: JobResult;
  refreshLock?: boolean;
  nowMs?: number;
}): Promise<PipelineJob> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  const currentDoc = await databases.getDocument(databaseId, jobsCollection, params.jobId);
  const current = mapJobDocument(currentDoc);
  assertJobLockHeld(current, params.lockToken, "complete");
  if (current.status !== "running") {
    throw new JobLockMismatchError("Cannot patch result unless job is running");
  }
  const bag = parsePayloadBag(currentDoc.payload);
  const { input_hash: _a, artifact_hash: _b, last_error: _c, result: _d, ...extra } = bag;
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  const patch: Record<string, unknown> = {
    payload: buildPayloadString(
      {
        inputHash: current.inputHash,
        artifactHash: current.artifactHash,
        lastError: current.lastError,
        result: params.result
      },
      extra
    )
  };
  if (params.refreshLock) {
    patch.locked_at = nowIso;
  }
  await databases.updateDocument(databaseId, jobsCollection, params.jobId, patch);
  const refreshed = mapJobDocument(
    await databases.getDocument(databaseId, jobsCollection, params.jobId)
  );
  if (refreshed.lockToken !== params.lockToken || refreshed.status !== "running") {
    throw new JobLockMismatchError("Progress patch lost race after write");
  }
  return refreshed;
}

export async function failJob(params: {
  jobId: string;
  lockToken: string;
  error: string;
  nowMs?: number;
  terminal?: boolean;
}): Promise<PipelineJob> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  const currentDoc = await databases.getDocument(databaseId, jobsCollection, params.jobId);
  const current = mapJobDocument(currentDoc);
  assertJobLockHeld(current, params.lockToken, "fail");
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  const forTransition: PipelineJob = params.terminal
    ? { ...current, attempt: current.maxAttempts }
    : current;
  const next = applyJobTransition(forTransition, {
    action: "fail",
    lockToken: params.lockToken,
    error: truncateJobError(params.error),
    at: nowIso
  });
  const bag = parsePayloadBag(currentDoc.payload);
  const { input_hash: _a, artifact_hash: _b, last_error: _c, result: _d, ...extra } = bag;
  await databases.updateDocument(databaseId, jobsCollection, params.jobId, {
    status: next.status,
    locked_at: null,
    lock_token: null,
    next_run_at: next.nextRunAt,
    attempt: next.attempt,
    payload: buildPayloadString(next, extra)
  });
  const refreshed = mapJobDocument(
    await databases.getDocument(databaseId, jobsCollection, params.jobId)
  );
  if (refreshed.status !== next.status) {
    throw new JobLockMismatchError("Fail lost race after write");
  }
  if (refreshed.lockToken !== null) {
    throw new JobLockMismatchError("Fail lost race: lock still held");
  }
  return refreshed;
}

export async function downloadSourceFile(fileId: string): Promise<Uint8Array> {
  const { storage, sourceBucket } = createWorkerAppwrite();
  const arrayBuffer = await storage.getFileDownload(sourceBucket, fileId);
  return new Uint8Array(arrayBuffer);
}

export async function downloadAssetFile(fileId: string): Promise<Uint8Array | null> {
  const { storage, sourceBucket } = createWorkerAppwrite();
  const bucket = process.env.APPWRITE_ASSETS_BUCKET || sourceBucket;
  try {
    const arrayBuffer = await storage.getFileDownload(bucket, fileId);
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

export async function getProjectRecord(projectId: string): Promise<{
  sourceImagePath: string | null;
  mode: "popout" | "gallery" | "upload" | "figurine_3d";
  slug: string;
  settings: import("@kidar/core").ProjectSettings;
  settingsRaw: string;
}> {
  const { databases, databaseId, projectsCollection } = createWorkerAppwrite();
  const doc = await databases.getDocument(databaseId, projectsCollection, projectId);
  const data = doc as Models.Document & Record<string, unknown>;
  const settingsRaw =
    typeof data.settings === "string" ? data.settings : JSON.stringify(data.settings ?? {});
  let settings: import("@kidar/core").ProjectSettings = {
    title: "",
    theme: "#6d5dfc",
    scale: 1,
    offset: { x: 0, y: 0, z: 0 }
  };
  try {
    settings = { ...settings, ...(JSON.parse(settingsRaw) as import("@kidar/core").ProjectSettings) };
  } catch {
    // keep defaults
  }
  const modeRaw = String(data.mode ?? "popout");
  const mode =
    modeRaw === "gallery" ||
    modeRaw === "upload" ||
    modeRaw === "popout" ||
    modeRaw === "figurine_3d"
      ? modeRaw
      : "popout";
  return {
    sourceImagePath: (data.source_image_path as string | null) ?? null,
    mode,
    slug: String(data.slug ?? ""),
    settings,
    settingsRaw
  };
}

export async function getProjectSource(projectId: string): Promise<{
  sourceImagePath: string | null;
  mode: string;
  settingsRaw: string;
}> {
  const project = await getProjectRecord(projectId);
  return {
    sourceImagePath: project.sourceImagePath,
    mode: project.mode,
    settingsRaw: project.settingsRaw
  };
}

export async function listJobsForProject(projectId: string): Promise<PipelineJob[]> {
  const { databases, databaseId, jobsCollection } = createWorkerAppwrite();
  const result = await databases.listDocuments(databaseId, jobsCollection, [
    Query.equal("project_id", projectId),
    Query.orderDesc("$createdAt"),
    Query.limit(50)
  ]);
  return result.documents.map(mapJobDocument);
}

export async function markProjectStatus(
  projectId: string,
  status: "ready" | "error" | "processing",
  settingsPatch?: Record<string, unknown>
): Promise<void> {
  const { databases, databaseId, projectsCollection } = createWorkerAppwrite();
  const doc = await databases.getDocument(databaseId, projectsCollection, projectId);
  const data = doc as Models.Document & Record<string, unknown>;
  const payload: Record<string, unknown> = { status };
  if (settingsPatch) {
    let current: Record<string, unknown> = {};
    try {
      current =
        typeof data.settings === "string"
          ? (JSON.parse(data.settings) as Record<string, unknown>)
          : ((data.settings as Record<string, unknown>) ?? {});
    } catch {
      current = {};
    }
    payload.settings = JSON.stringify({ ...current, ...settingsPatch });
  }
  await databases.updateDocument(databaseId, projectsCollection, projectId, payload);
}
