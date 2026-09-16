import { describe, expect, it, vi } from "vitest";
import {
  PopoutBuildError,
  PublicStorageConfigError,
  assertPopoutCoverage,
  assertPopoutInputs,
  popoutArtifactKey,
  type PipelineJob
} from "@kidar/core";
import { NodeIO } from "@gltf-transform/core";
import { buildPopoutGlb, isGlbBuffer } from "./build-glb";
import { createCutoutFromRgba } from "./cutout-rgba";
import { optimizeGlb } from "./optimize";
import { runPopoutBuildStage } from "./stage";
import { MemoryPublicArtifactStorage } from "../storage/public";

function baseJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id: "job_1",
    projectId: "proj_fixture",
    type: "popout_build",
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: new Date().toISOString(),
    lockToken: "lock-token-1",
    lastError: null,
    inputHash: "a".repeat(64),
    artifactHash: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function silhouetteRgba(width = 64, height = 64): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inside = x > 16 && x < 48 && y > 16 && y < 48;
      rgba[i] = 220;
      rgba[i + 1] = 80;
      rgba[i + 2] = 40;
      rgba[i + 3] = inside ? 255 : 0;
    }
  }
  return rgba;
}

describe("popout stage inputs and coverage", () => {
  it("validates required input data", () => {
    expect(() =>
      assertPopoutInputs({
        projectId: "p",
        inputHash: "h",
        sourceFileId: "s",
        sourceBytes: new Uint8Array()
      })
    ).toThrow(PopoutBuildError);
  });

  it("marks coverage >= 90% as non-retryable", () => {
    expect(() =>
      assertPopoutCoverage({
        coverage: 0.91,
        vertexCount: 4,
        bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 }
      })
    ).toThrow(/refusing full-rectangle/);
  });

  it("builds deterministic artifact keys", () => {
    expect(popoutArtifactKey("proj", "ab".repeat(32))).toBe(
      `models/proj/${"ab".repeat(32)}/popout.glb`
    );
  });
});

describe("popout GLB generation", () => {
  it("produces a parseable extruded GLB from silhouette RGBA", async () => {
    const rgba = silhouetteRgba();
    const cut = createCutoutFromRgba(64, 64, rgba);
    const raw = await buildPopoutGlb({
      polygons: cut.polygons,
      width: cut.width,
      height: cut.height,
      rgba: cut.rgba,
      theme: "#336699"
    });
    expect(isGlbBuffer(raw)).toBe(true);
    expect(raw.byteLength).toBeGreaterThan(100);

    const { bytes, report } = await optimizeGlb(raw);
    expect(isGlbBuffer(bytes)).toBe(true);
    expect(report.operations).toEqual(["dedup", "weld", "prune"]);
    expect(report.optimizedBytes).toBeLessThanOrEqual(report.rawBytes);
    expect(report.optimizedBytes).toBeLessThan(1.5 * 1024 * 1024);

    const document = await new NodeIO().readBinary(bytes);
    const meshes = document.getRoot().listMeshes();
    expect(meshes.length).toBeGreaterThan(0);
    const primitives = meshes.flatMap((mesh) => mesh.listPrimitives());
    expect(primitives.length).toBeGreaterThan(0);
    const positions = primitives[0].getAttribute("POSITION");
    expect(positions).toBeTruthy();
    expect((positions?.getCount() ?? 0) > 8).toBe(true);
  });
});

describe("popout stage persistence rules", () => {
  it("treats matching existing artifact hash as idempotent success", async () => {
    const rgba = silhouetteRgba();
    const cut = createCutoutFromRgba(64, 64, rgba);
    const job = baseJob();
    const storage = new MemoryPublicArtifactStorage();
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));

    const deps = {
      storage,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "popout",
        settingsRaw: "{}"
      }),
      loadSource: async () => new Uint8Array([1, 2, 3, 4]),
      cutout: async () => cut,
      complete
    };

    const first = await runPopoutBuildStage(job, deps);
    expect(first.kind).toBe("written");
    complete.mockClear();

    const second = await runPopoutBuildStage(job, deps);
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
    const rgba = silhouetteRgba();
    const cut = createCutoutFromRgba(64, 64, rgba);

    await expect(
      runPopoutBuildStage(job, {
        storage: failingStorage,
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          settingsRaw: "{}"
        }),
        loadSource: async () => new Uint8Array([1]),
        cutout: async () => cut,
        complete
      })
    ).rejects.toBeInstanceOf(PublicStorageConfigError);
    expect(complete).not.toHaveBeenCalled();
  });

  it("rejects final mutation when lock token mismatches", async () => {
    const job = baseJob({ lockToken: "expected" });
    const rgba = silhouetteRgba();
    const cut = createCutoutFromRgba(64, 64, rgba);
    const complete = vi.fn(async () => {
      throw new Error("Lock token mismatch on complete");
    });

    await expect(
      runPopoutBuildStage(job, {
        storage: new MemoryPublicArtifactStorage(),
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          settingsRaw: "{}"
        }),
        loadSource: async () => new Uint8Array([1]),
        cutout: async () => cut,
        complete
      })
    ).rejects.toThrow(/Lock token mismatch/);
  });
});

