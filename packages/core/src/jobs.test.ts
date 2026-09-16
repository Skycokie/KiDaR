import { describe, expect, it } from "vitest";
import {
  JOB_MAX_ATTEMPTS,
  JOB_RETRY_BASE_DELAY_MS,
  applyJobTransition,
  canTransition,
  isEligibleToClaim,
  isIdempotentHit,
  isLockExpired,
  isTerminalFailure,
  retryDelayMs,
  truncateJobError,
  type PipelineJob
} from "./jobs";

function baseJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id: "job_1",
    projectId: "proj_1",
    type: "popout_build",
    status: "queued",
    attempt: 0,
    maxAttempts: JOB_MAX_ATTEMPTS,
    nextRunAt: null,
    lockedAt: null,
    lockToken: null,
    lastError: null,
    inputHash: "abc",
    artifactHash: null,
    result: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("job state transitions", () => {
  it("allows legal transitions only", () => {
    expect(canTransition("queued", "running")).toBe(true);
    expect(canTransition("running", "done")).toBe(true);
    expect(canTransition("running", "error")).toBe(true);
    expect(canTransition("running", "queued")).toBe(true);
    expect(canTransition("running", "running")).toBe(true);
    expect(canTransition("done", "queued")).toBe(false);
    expect(canTransition("error", "running")).toBe(false);
    expect(canTransition("queued", "done")).toBe(false);
  });

  it("claims queued jobs and increments attempt", () => {
    const claimed = applyJobTransition(baseJob(), {
      action: "claim",
      lockToken: "tok-1",
      at: "2026-01-01T00:01:00.000Z"
    });
    expect(claimed.status).toBe("running");
    expect(claimed.attempt).toBe(1);
    expect(claimed.lockToken).toBe("tok-1");
  });

  it("completes only with matching lock token", () => {
    const running = baseJob({
      status: "running",
      attempt: 1,
      lockToken: "tok-1",
      lockedAt: "2026-01-01T00:01:00.000Z"
    });
    expect(() =>
      applyJobTransition(running, { action: "complete", lockToken: "wrong" })
    ).toThrow(/Lock token mismatch/);
    const done = applyJobTransition(running, {
      action: "complete",
      lockToken: "tok-1",
      artifactHash: "art",
      result: { ok: true }
    });
    expect(done.status).toBe("done");
    expect(done.lockToken).toBeNull();
    expect(done.artifactHash).toBe("art");
  });
});

describe("retry and terminal failure", () => {
  it("uses exponential backoff without jitter by default", () => {
    expect(retryDelayMs(1)).toBe(JOB_RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(2)).toBe(JOB_RETRY_BASE_DELAY_MS * 2);
    expect(retryDelayMs(3)).toBe(JOB_RETRY_BASE_DELAY_MS * 4);
  });

  it("applies injectable jitter in tests", () => {
    const delay = retryDelayMs(1, { jitterRatio: 0.2, random: () => 0 });
    expect(delay).toBe(Math.round(JOB_RETRY_BASE_DELAY_MS * 0.9));
  });

  it("requeues with nextRunAt until max attempts, then errors", () => {
    const running1 = baseJob({
      status: "running",
      attempt: 1,
      lockToken: "tok",
      lockedAt: "2026-01-01T00:01:00.000Z"
    });
    const queued = applyJobTransition(running1, {
      action: "fail",
      lockToken: "tok",
      error: "boom",
      at: "2026-01-01T00:01:05.000Z"
    });
    expect(queued.status).toBe("queued");
    expect(queued.nextRunAt).toBe(
      new Date(Date.parse("2026-01-01T00:01:05.000Z") + JOB_RETRY_BASE_DELAY_MS).toISOString()
    );
    expect(isTerminalFailure(3)).toBe(true);

    const running3 = baseJob({
      status: "running",
      attempt: 3,
      lockToken: "tok",
      lockedAt: "2026-01-01T00:02:00.000Z"
    });
    const failed = applyJobTransition(running3, {
      action: "fail",
      lockToken: "tok",
      error: "final",
      at: "2026-01-01T00:02:01.000Z"
    });
    expect(failed.status).toBe("error");
    expect(failed.lockToken).toBeNull();
  });

  it("truncates oversized errors", () => {
    expect(truncateJobError("a".repeat(3000)).length).toBeLessThanOrEqual(2000);
  });
});

describe("lock expiry and reclaim", () => {
  it("detects expired locks", () => {
    const lockedAt = "2026-01-01T00:00:00.000Z";
    expect(isLockExpired(lockedAt, Date.parse("2026-01-01T00:04:00.000Z"))).toBe(false);
    expect(isLockExpired(lockedAt, Date.parse("2026-01-01T00:05:00.000Z"))).toBe(true);
  });

  it("allows reclaim of stale running jobs without bumping attempt", () => {
    const stale = baseJob({
      status: "running",
      attempt: 1,
      lockedAt: "2026-01-01T00:00:00.000Z",
      lockToken: "old"
    });
    expect(isEligibleToClaim(stale, Date.parse("2026-01-01T00:10:00.000Z"))).toBe(true);
    const reclaimed = applyJobTransition(stale, {
      action: "claim",
      lockToken: "new",
      at: "2026-01-01T00:10:00.000Z"
    });
    expect(reclaimed.lockToken).toBe("new");
    expect(reclaimed.attempt).toBe(1);
  });

  it("respects nextRunAt for queued jobs", () => {
    const delayed = baseJob({
      nextRunAt: "2026-01-01T00:10:00.000Z"
    });
    expect(isEligibleToClaim(delayed, Date.parse("2026-01-01T00:09:00.000Z"))).toBe(false);
    expect(isEligibleToClaim(delayed, Date.parse("2026-01-01T00:10:00.000Z"))).toBe(true);
  });
});

describe("idempotent success", () => {
  it("recognizes done jobs with matching input hash", () => {
    expect(isIdempotentHit(baseJob({ status: "done", inputHash: "x" }), "x")).toBe(true);
    expect(isIdempotentHit(baseJob({ status: "queued", inputHash: "x" }), "x")).toBe(false);
    expect(isIdempotentHit(null, "x")).toBe(false);
  });
});
