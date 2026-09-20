import { describe, expect, it } from "vitest";
import {
  JOB_MAX_ATTEMPTS,
  JOB_RETRY_BASE_DELAY_MS,
  JobLockMismatchError,
  PAGE_RENDER_DEFER_MS,
  applyJobTransition,
  assertJobLockHeld,
  canTransition,
  isEligibleToClaim,
  isIdempotentHit,
  isLockExpired,
  isTerminalFailure,
  pageRenderDeferralIso,
  prioritizeClaimCandidates,
  retryDelayMs,
  selectPageRenderClaimAction,
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

describe("CAS lock asserts and claim scheduling", () => {
  it("rejects complete/fail when lock token is stale or job is not running", () => {
    const running = baseJob({
      status: "running",
      attempt: 1,
      lockToken: "tok-new",
      lockedAt: "2026-01-01T00:01:00.000Z"
    });
    expect(() => assertJobLockHeld(running, "tok-old", "complete")).toThrow(JobLockMismatchError);
    expect(() => assertJobLockHeld(running, "tok-old", "fail")).toThrow(/Lock token mismatch/);
    expect(() =>
      assertJobLockHeld(baseJob({ status: "done", lockToken: null }), "tok-new", "complete")
    ).toThrow(/not running/);
    expect(() =>
      applyJobTransition(running, { action: "complete", lockToken: "tok-old" })
    ).toThrow(JobLockMismatchError);
  });

  it("simulates stale worker losing to a reclaimed lock before complete", () => {
    const store = new Map<string, PipelineJob>();
    store.set(
      "job_1",
      baseJob({
        status: "running",
        attempt: 1,
        lockToken: "tok-old",
        lockedAt: "2026-01-01T00:00:00.000Z"
      })
    );

    // Newer worker reclaims after TTL.
    const stale = store.get("job_1")!;
    const reclaimed = applyJobTransition(stale, {
      action: "claim",
      lockToken: "tok-new",
      at: "2026-01-01T00:10:00.000Z"
    });
    store.set("job_1", reclaimed);

    // Stale worker re-reads and must not complete.
    const current = store.get("job_1")!;
    expect(() => assertJobLockHeld(current, "tok-old", "complete")).toThrow(JobLockMismatchError);
    expect(store.get("job_1")!.lockToken).toBe("tok-new");
    expect(store.get("job_1")!.status).toBe("running");
  });

  it("documents the remaining TOCTOU: assert-then-write is not atomic without Appwrite precondition", () => {
    // Models the Appwrite limitation: updateDocument cannot require
    // lock_token === expected. A stale worker that already passed assertJobLockHeld
    // on an older snapshot can still overwrite after reclaim.
    const store = new Map<string, PipelineJob>();
    store.set(
      "job_1",
      baseJob({
        status: "running",
        attempt: 1,
        lockToken: "tok-a",
        lockedAt: "2026-01-01T00:00:00.000Z"
      })
    );

    const snapshotA = store.get("job_1")!;
    assertJobLockHeld(snapshotA, "tok-a", "complete"); // passes on stale view

    const reclaimed = applyJobTransition(store.get("job_1")!, {
      action: "claim",
      lockToken: "tok-b",
      at: "2026-01-01T00:10:00.000Z"
    });
    store.set("job_1", reclaimed);

    // Blind updateDocument equivalent — no lock_token precondition available.
    const overwritten = applyJobTransition(snapshotA, {
      action: "complete",
      lockToken: "tok-a",
      result: { from: "stale-a" }
    });
    store.set("job_1", overwritten);

    expect(store.get("job_1")!.status).toBe("done");
    expect(store.get("job_1")!.result).toEqual({ from: "stale-a" });
    // Reclaim was lost: this is why F1 is detection/narrowing, not full CAS.
    // Production must stay single-worker until conditional mutation exists.
  });

  it("prioritizes upstream jobs ahead of page_render and defers unready page_render", () => {
    const ordered = prioritizeClaimCandidates([
      baseJob({ id: "page", type: "page_render" }),
      baseJob({ id: "pop", type: "popout_build" }),
      baseJob({ id: "mind", type: "mind_compile" })
    ]);
    expect(ordered.map((j) => j.id)).toEqual(["pop", "mind", "page"]);

    expect(selectPageRenderClaimAction({ type: "popout_build" }, null)).toBe("claim");
    expect(
      selectPageRenderClaimAction({ type: "page_render", dependsOn: undefined }, null)
    ).toBe("reject_missing_depends_on");
    expect(
      selectPageRenderClaimAction(
        { type: "page_render", dependsOn: { mind_compile: "abc" } },
        false
      )
    ).toBe("defer");
    expect(
      selectPageRenderClaimAction(
        { type: "page_render", dependsOn: { mind_compile: "abc" } },
        true
      )
    ).toBe("claim");

    const deferred = pageRenderDeferralIso(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(deferred).toBe(
      new Date(Date.parse("2026-01-01T00:00:00.000Z") + PAGE_RENDER_DEFER_MS).toISOString()
    );
    expect(
      isEligibleToClaim(
        baseJob({ status: "queued", nextRunAt: deferred, type: "page_render" }),
        Date.parse("2026-01-01T00:00:01.000Z")
      )
    ).toBe(false);
  });
});
