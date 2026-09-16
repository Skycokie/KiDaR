import { describe, expect, it, vi } from "vitest";
import {
  MindCompileError,
  PublicStorageConfigError,
  assertMindCompileInputs,
  assertSupportedSourceImage,
  mindArtifactKey,
  type PipelineJob
} from "@kidar/core";
import { describeMindCompileInvocation } from "./compile";
import { runMindCompileStage } from "./stage";
import { MemoryPublicArtifactStorage } from "../storage/public";

function baseJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id: "job_mind_1",
    projectId: "proj_fixture",
    type: "mind_compile",
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: new Date().toISOString(),
    lockToken: "lock-token-1",
    lastError: null,
    inputHash: "b".repeat(64),
    artifactHash: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

describe("mind compile inputs and keys", () => {
  it("validates required input data", () => {
    expect(() =>
      assertMindCompileInputs({
        projectId: "p",
        inputHash: "h",
        sourceFileId: "s",
        sourceBytes: new Uint8Array()
      })
    ).toThrow(MindCompileError);
  });

  it("builds deterministic artifact keys", () => {
    expect(mindArtifactKey("proj", "cd".repeat(32))).toBe(
      `targets/proj/${"cd".repeat(32)}/targets.mind`
    );
  });

  it("classifies unsupported source as non-retryable", () => {
    try {
      assertSupportedSourceImage(new Uint8Array([1, 2, 3]));
    } catch (error) {
      expect(error).toBeInstanceOf(MindCompileError);
      expect((error as MindCompileError).retryable).toBe(false);
      expect((error as MindCompileError).code).toBe("UNSUPPORTED_SOURCE_TYPE");
    }
  });
});

describe("mind compile adapter description", () => {
  it("describes OfflineCompiler invocation without claiming a real .mind binary", () => {
    const desc = describeMindCompileInvocation({
      projectId: "proj",
      inputHash: "ab".repeat(32),
      sourceBytes: 1234,
      mime: "image/jpeg"
    });
    expect(desc.entry).toBe("mind-ar/src/image-target/offline-compiler.js");
    expect(desc.loader).toBe("canvas.loadImage");
    expect(desc.packageVersion).toBe("1.2.5");
    expect(desc.targetCount).toBe(1);
    // Explicit: this unit test does not run OfflineCompiler or invent a .mind file.
    expect(desc).not.toHaveProperty("mindBytes");
  });
});

describe("mind compile stage persistence rules", () => {
  it("treats matching existing artifact hash as idempotent success", async () => {
    const job = baseJob();
    const storage = new MemoryPublicArtifactStorage();
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));
    const fakeMind = new Uint8Array([0x82, 0xa1, 0x76, 0x02, 0xa8, 0x64, 0x61, 0x74, 0x61, 0x4c, 0x69, 0x73, 0x74, 0x90]);

    const deps = {
      storage,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "popout",
        settingsRaw: "{}"
      }),
      loadSource: async () => jpegBytes,
      compile: async () => fakeMind,
      complete
    };

    const first = await runMindCompileStage(job, deps);
    expect(first.kind).toBe("written");
    expect(first.mindBytes).toBe(fakeMind.byteLength);
    complete.mockClear();

    const second = await runMindCompileStage(job, deps);
    expect(second.kind).toBe("idempotent");
    expect(complete).toHaveBeenCalledOnce();
    expect(second.artifactKey).toBe(first.artifactKey);
  });

  it("does not mark done when public storage is unavailable", async () => {
    const job = baseJob();
    const failingStorage = {
      provider: "r2" as const,
      async write() {
        throw new PublicStorageConfigError("R2 unavailable");
      },
      async exists() {
        return false;
      },
      getPublicUrl(key: string) {
        return key;
      },
      async getMetadata() {
        return null;
      }
    };
    const complete = vi.fn();

    await expect(
      runMindCompileStage(job, {
        storage: failingStorage,
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          settingsRaw: "{}"
        }),
        loadSource: async () => jpegBytes,
        compile: async () => new Uint8Array([1, 2, 3, 4]),
        complete
      })
    ).rejects.toBeInstanceOf(PublicStorageConfigError);
    expect(complete).not.toHaveBeenCalled();
  });

  it("rejects final mutation when lock token mismatches", async () => {
    const job = baseJob({ lockToken: "expected" });
    const complete = vi.fn(async () => {
      throw new Error("Lock token mismatch on complete");
    });

    await expect(
      runMindCompileStage(job, {
        storage: new MemoryPublicArtifactStorage(),
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          settingsRaw: "{}"
        }),
        loadSource: async () => jpegBytes,
        compile: async () => new Uint8Array([9, 8, 7, 6]),
        complete
      })
    ).rejects.toThrow(/Lock token mismatch/);
  });

  it("fails non-retryable when compiler returns empty mind bytes", async () => {
    const job = baseJob();
    await expect(
      runMindCompileStage(job, {
        storage: new MemoryPublicArtifactStorage(),
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          settingsRaw: "{}"
        }),
        loadSource: async () => jpegBytes,
        compile: async () => new Uint8Array()
      })
    ).rejects.toMatchObject({ code: "INVALID_MIND", retryable: false });
  });
});
