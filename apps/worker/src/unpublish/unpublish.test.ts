import { describe, expect, it, vi } from "vitest";
import type { PipelineJob } from "@kidar/core";
import { UnpublishError, handleUnpublishJobFailure, runUnpublishStage } from "./stage";

function baseJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id: "job-1",
    projectId: "proj-1",
    type: "unpublish",
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: new Date().toISOString(),
    lockToken: "lock-1",
    lastError: null,
    inputHash: "abc",
    artifactHash: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe("unpublish stage", () => {
  it("deletes only allow-listed keys from the job payload", async () => {
    const deleteKeys = vi.fn(async (keys: string[]) => ({
      deleted: keys,
      skipped: [] as string[]
    }));
    const complete = vi.fn(async () => baseJob({ status: "done", lockToken: null }));

    const result = await runUnpublishStage(baseJob(), {
      loadPayload: async () => ({
        slug: "demo",
        keys: [
          "experiences/demo/target.txt",
          "models/p1/hash/figurine.glb",
          "pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html"
        ]
      }),
      deleteKeys,
      complete
    });

    expect(deleteKeys).toHaveBeenCalledWith([
      "experiences/demo/target.txt",
      "pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html"
    ]);
    expect(result.deleted).toHaveLength(2);
    expect(complete).toHaveBeenCalledOnce();
  });

  it("fails closed when no allow-listed keys remain", async () => {
    await expect(
      runUnpublishStage(baseJob(), {
        loadPayload: async () => ({ keys: ["models/evil.glb"] }),
        deleteKeys: async () => ({ deleted: [], skipped: [] }),
        complete: async () => baseJob()
      })
    ).rejects.toThrow(/missing allow-listed/i);
  });

  it("marks non-retryable failures terminal", async () => {
    const fail = vi.fn(async () => baseJob({ status: "error", lockToken: null }));
    await handleUnpublishJobFailure(
      baseJob(),
      new UnpublishError("Unpublish job missing allow-listed keys", { retryable: false }),
      fail
    );
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ terminal: true, error: expect.stringMatching(/allow-listed/i) })
    );
  });
});
