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
import { PNG } from "pngjs";
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

/** Red in the image-top half of the silhouette, blue in the image-bottom half. */
function asymmetricSilhouetteRgba(width = 32, height = 32): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const midY = height / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inside = x >= 8 && x < 24 && y >= 8 && y < 24;
      const topHalf = y < midY;
      rgba[i] = inside ? (topHalf ? 220 : 20) : 0;
      rgba[i + 1] = 20;
      rgba[i + 2] = inside ? (topHalf ? 20 : 220) : 0;
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
    const uvs = primitives[0].getAttribute("TEXCOORD_0");
    expect(uvs).toBeTruthy();
    const positions = primitives[0].getAttribute("POSITION");
    expect(positions).toBeTruthy();
    expect(uvs!.getCount()).toBe(positions!.getCount());
    const uvArray = uvs!.getArray();
    expect(uvArray).toBeTruthy();
    let minU = 1;
    let maxU = 0;
    let minV = 1;
    let maxV = 0;
    for (let i = 0; i + 1 < (uvArray?.length ?? 0); i += 2) {
      const u = uvArray![i];
      const v = uvArray![i + 1];
      expect(Number.isFinite(u)).toBe(true);
      expect(Number.isFinite(v)).toBe(true);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    expect(minU).toBeGreaterThanOrEqual(0);
    expect(maxU).toBeLessThanOrEqual(1);
    expect(minV).toBeGreaterThanOrEqual(0);
    expect(maxV).toBeLessThanOrEqual(1);
    expect(maxU - minU).toBeGreaterThan(0.2);
    expect(maxV - minV).toBeGreaterThan(0.2);
  });

  it("maps image-top red and image-bottom blue through glTF v=0-at-bottom UVs", async () => {
    const width = 32;
    const height = 32;
    const rgba = asymmetricSilhouetteRgba(width, height);
    const cut = createCutoutFromRgba(width, height, rgba);
    expect(cut.polygons.length).toBeGreaterThan(0);
    const raw = await buildPopoutGlb({
      polygons: cut.polygons,
      width: cut.width,
      height: cut.height,
      rgba: cut.rgba,
      theme: "#336699"
    });
    const { bytes } = await optimizeGlb(raw);
    const document = await new NodeIO().readBinary(bytes);
    const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
    const uvs = primitive.getAttribute("TEXCOORD_0");
    expect(uvs).toBeTruthy();
    const image = document.getRoot().listTextures()[0]?.getImage();
    expect(image).toBeTruthy();
    const png = PNG.sync.read(Buffer.from(image!));

    const sample = (u: number, v: number) => {
      const px = Math.min(png.width - 1, Math.max(0, Math.round(u * (png.width - 1))));
      const py = Math.min(png.height - 1, Math.max(0, Math.round((1 - v) * (png.height - 1))));
      const i = (py * png.width + px) * 4;
      return { r: png.data[i], b: png.data[i + 2], a: png.data[i + 3], py };
    };

    const uvArray = uvs!.getArray()!;
    let topV = -Infinity;
    let bottomV = Infinity;
    let topSample = { r: 0, b: 0, a: 0, py: 0 };
    let bottomSample = { r: 0, b: 0, a: 0, py: 0 };
    for (let i = 0; i + 1 < uvArray.length; i += 2) {
      const u = uvArray[i];
      const v = uvArray[i + 1];
      const sampled = sample(u, v);
      if (sampled.a < 200) continue;
      if (v > topV) {
        topV = v;
        topSample = sampled;
      }
      if (v < bottomV) {
        bottomV = v;
        bottomSample = sampled;
      }
    }
    expect(topV).toBeGreaterThan(bottomV);
    expect(topSample.r).toBeGreaterThan(topSample.b);
    expect(bottomSample.b).toBeGreaterThan(bottomSample.r);
    expect(topSample.py).toBeLessThan(bottomSample.py);
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

