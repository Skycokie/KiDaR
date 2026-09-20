/**
 * Pipeline job contracts and pure lifecycle rules (M4.1).
 *
 * Appwrite stores `type` in the existing `step` attribute for compatibility.
 * Persistence adapters map between this model and document fields.
 */

export const JOB_TYPES = ["popout_build", "mind_compile", "page_render"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "done", "error"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Maximum execution attempts (including the first try). */
export const JOB_MAX_ATTEMPTS = 3;

/**
 * Retry backoff after a failed attempt `n` (1-based completed attempts):
 *   delay = min(BASE * 2^(n-1), MAX)
 *   n=1 → 5s, n=2 → 10s; after n=3 the job is terminal `error`.
 */
export const JOB_RETRY_BASE_DELAY_MS = 5_000;
export const JOB_RETRY_MAX_DELAY_MS = 60_000;

/** Running jobs older than this may be reclaimed into `queued`. */
export const JOB_LOCK_TTL_MS = 5 * 60_000;

export const LAST_ERROR_MAX_LENGTH = 2_000;

export type JobResult = Record<string, unknown>;

export interface PipelineJob {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  nextRunAt: string | null;
  lockedAt: string | null;
  lockToken: string | null;
  lastError: string | null;
  inputHash: string;
  artifactHash: string | null;
  result: JobResult | null;
  createdAt: string;
  updatedAt: string;
  /** Upstream job hashes when this job's inputHash is page_render-specific. */
  dependsOn?: {
    popout_build?: string;
    mind_compile?: string;
  };
}

export type JobTransition =
  | { action: "claim"; lockToken: string; at: string }
  | { action: "complete"; lockToken: string; artifactHash?: string; result?: JobResult }
  | { action: "fail"; lockToken: string; error: string; at: string }
  | { action: "requeue"; at: string };

const LEGAL: Record<JobStatus, ReadonlySet<JobStatus>> = {
  queued: new Set(["running"]),
  // running → running is a lock reclaim (same attempt, new token).
  running: new Set(["done", "error", "queued", "running"]),
  done: new Set(),
  error: new Set()
};

export function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return LEGAL[from].has(to);
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal job transition: ${from} → ${to}`);
  }
}

export function truncateJobError(message: string, max = LAST_ERROR_MAX_LENGTH): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

/**
 * Delay before the next attempt after `failedAttempt` has just failed.
 * `failedAttempt` is 1-based count of finished attempts.
 */
export function retryDelayMs(
  failedAttempt: number,
  options?: { jitterRatio?: number; random?: () => number }
): number {
  if (failedAttempt < 1) return 0;
  const exp = Math.min(
    JOB_RETRY_BASE_DELAY_MS * 2 ** (failedAttempt - 1),
    JOB_RETRY_MAX_DELAY_MS
  );
  const jitterRatio = options?.jitterRatio ?? 0;
  if (jitterRatio <= 0) return exp;
  const random = options?.random ?? Math.random;
  const span = exp * jitterRatio;
  return Math.max(0, Math.round(exp - span / 2 + random() * span));
}

export function isTerminalFailure(attempt: number, maxAttempts = JOB_MAX_ATTEMPTS): boolean {
  return attempt >= maxAttempts;
}

/** Whether a `running` job's lock has expired and may be reclaimed. */
export function isLockExpired(
  lockedAt: string | null | undefined,
  nowMs: number,
  lockTtlMs = JOB_LOCK_TTL_MS
): boolean {
  if (!lockedAt) return true;
  const lockedMs = Date.parse(lockedAt);
  if (Number.isNaN(lockedMs)) return true;
  return nowMs - lockedMs >= lockTtlMs;
}

export function isEligibleToClaim(
  job: Pick<PipelineJob, "status" | "nextRunAt" | "lockedAt">,
  nowMs: number,
  lockTtlMs = JOB_LOCK_TTL_MS
): boolean {
  if (job.status === "queued") {
    if (!job.nextRunAt) return true;
    const next = Date.parse(job.nextRunAt);
    return Number.isNaN(next) || next <= nowMs;
  }
  if (job.status === "running") {
    return isLockExpired(job.lockedAt, nowMs, lockTtlMs);
  }
  return false;
}

/**
 * Pure transition applicator. Does not persist.
 * Callers must verify `lockToken` matches before applying claim outcomes.
 */
export function applyJobTransition(
  job: PipelineJob,
  transition: JobTransition
): PipelineJob {
  switch (transition.action) {
    case "claim": {
      if (!isEligibleToClaim(job, Date.parse(transition.at))) {
        throw new Error("Job is not eligible to claim");
      }
      const from = job.status === "running" ? "running" : "queued";
      assertTransition(from, "running");
      // Reclaim of a stale lock keeps the same attempt; fresh claims increment.
      const attempt = job.status === "running" ? job.attempt : job.attempt + 1;
      return {
        ...job,
        status: "running",
        attempt,
        lockedAt: transition.at,
        lockToken: transition.lockToken,
        nextRunAt: null,
        updatedAt: transition.at
      };
    }
    case "complete": {
      if (job.lockToken !== transition.lockToken) {
        throw new Error("Lock token mismatch on complete");
      }
      assertTransition(job.status, "done");
      return {
        ...job,
        status: "done",
        lockedAt: null,
        lockToken: null,
        lastError: null,
        artifactHash: transition.artifactHash ?? job.artifactHash,
        result: transition.result ?? job.result,
        updatedAt: new Date().toISOString()
      };
    }
    case "fail": {
      if (job.lockToken !== transition.lockToken) {
        throw new Error("Lock token mismatch on fail");
      }
      if (job.status !== "running") {
        throw new Error("Only running jobs can fail");
      }
      const error = truncateJobError(transition.error);
      if (isTerminalFailure(job.attempt, job.maxAttempts)) {
        assertTransition("running", "error");
        return {
          ...job,
          status: "error",
          lastError: error,
          lockedAt: null,
          lockToken: null,
          nextRunAt: null,
          updatedAt: transition.at
        };
      }
      assertTransition("running", "queued");
      const delay = retryDelayMs(job.attempt);
      const nextRunAt = new Date(Date.parse(transition.at) + delay).toISOString();
      return {
        ...job,
        status: "queued",
        lastError: error,
        lockedAt: null,
        lockToken: null,
        nextRunAt,
        updatedAt: transition.at
      };
    }
    case "requeue": {
      if (job.status !== "running" || !isLockExpired(job.lockedAt, Date.parse(transition.at))) {
        throw new Error("Job is not eligible to requeue");
      }
      assertTransition("running", "queued");
      return {
        ...job,
        status: "queued",
        lockedAt: null,
        lockToken: null,
        nextRunAt: transition.at,
        updatedAt: transition.at
      };
    }
    default: {
      const _exhaustive: never = transition;
      throw new Error(`Unknown transition: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Idempotent success: a prior `done` job with the same input hash. */
export function isIdempotentHit(
  existing: Pick<PipelineJob, "status" | "inputHash"> | null | undefined,
  inputHash: string
): boolean {
  return Boolean(existing && existing.status === "done" && existing.inputHash === inputHash);
}
