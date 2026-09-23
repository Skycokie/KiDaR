import { describe, expect, it, vi } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import type { PipelineJob, PublicArtifactStorage } from "@kidar/core";
import { runFigurineBuildStage } from "./stage";
import type { TripoImageToModelProvider } from "../tripo/client";

async function tinyGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const position = doc
    .createAccessor()
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0.5]))
    .setType("VEC3")
    .setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setArray(new Uint16Array([0, 1, 2]))
    .setType("SCALAR")
    .setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute("POSITION", position).setIndices(indices);
  const mesh = doc.createMesh().addPrimitive(prim);
  doc.createNode().setMesh(mesh);
  doc.createScene().addChild(doc.getRoot().listNodes()[0]);
  return new NodeIO().writeBinary(doc);
}

function baseJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  const now = new Date().toISOString();
  return {
    id: "job1",
    projectId: "proj1",
    type: "figurine_build",
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: now,
    lockedAt: now,
    lockToken: "lock-1",
    lastError: null,
    inputHash: "abc123",
    artifactHash: null,
    result: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function memoryStorage(): {
  storage: PublicArtifactStorage;
  written: Map<string, { checksum?: string; size?: number }>;
  write: ReturnType<typeof vi.fn>;
} {
  const written = new Map<string, { checksum?: string; size?: number }>();
  const write = vi.fn(async (input: { key: string; checksum?: string; body: Uint8Array }) => {
    written.set(input.key, { checksum: input.checksum, size: input.body.byteLength });
    return { key: input.key, publicUrl: `https://ar.example.com/${input.key}` };
  });
  const storage: PublicArtifactStorage = {
    provider: "r2",
    write: write as never,
    async exists(key) {
      return written.has(key);
    },
    getPublicUrl(key) {
      return `https://ar.example.com/${key}`;
    },
    async getMetadata(key) {
      const hit = written.get(key);
      return hit ? { key, checksum: hit.checksum, size: hit.size } : null;
    }
  };
  return { storage, written, write };
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);

function projectLoader() {
  return async () => ({
    sourceImagePath: "src1",
    mode: "figurine_3d" as const,
    slug: "s",
    settings: { title: "", theme: "#000", scale: 1, offset: { x: 0, y: 0, z: 0 } },
    settingsRaw: "{}"
  });
}

describe("figurine_build stage (Go D retopo)", () => {
  it("reuses providerTaskId + retopoTaskId and does not re-submit costly tasks", async () => {
    const glb = await tinyGlb();
    let submitCount = 0;
    let retopoCount = 0;
    const downloadedUrls: string[] = [];
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => {
        throw new Error("should not upload when providerTaskId exists");
      },
      submitImageToModel: async () => {
        submitCount += 1;
        return { providerTaskId: "task_dup" };
      },
      submitModelConvert: async () => ({ providerTaskId: "convert_unused" }),
      submitMeshDecimate: async () => {
        retopoCount += 1;
        return { providerTaskId: "retopo_dup" };
      },
      getTask: async (id) => {
        if (id === "task_existing") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example.com/hi.glb" };
        }
        if (id === "retopo_existing") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example.com/lo.glb" };
        }
        throw new Error(`unexpected task ${id}`);
      },
      downloadModel: async (url) => {
        downloadedUrls.push(url);
        return Buffer.from(glb);
      }
    };

    const { storage } = memoryStorage();
    const complete = vi.fn(async () => baseJob({ status: "done" }));
    const markProject = vi.fn(async () => undefined);

    await runFigurineBuildStage(
      baseJob({
        result: {
          providerTaskId: "task_existing",
          retopoTaskId: "retopo_existing",
          subjectId: "primary"
        }
      }),
      {
        storage,
        provider,
        loadProject: projectLoader(),
        loadSource: async () => png,
        complete: complete as never,
        markProject: markProject as never,
        inspectSubject: async () => ({
          width: 512,
          height: 512,
          componentCount: 1,
          coverage: 0.2
        }),
        patchProgress: async (p) => baseJob({ result: p.result }),
        sleep: async () => undefined,
        providerTimeoutMs: 5_000
      }
    );

    expect(submitCount).toBe(0);
    expect(retopoCount).toBe(0);
    expect(downloadedUrls).toEqual(["https://cdn.example.com/lo.glb"]);
    expect(complete).toHaveBeenCalled();
    const completeArg = (
      complete.mock.calls as unknown as Array<
        [{ result?: { publicUrl?: string; providerTaskId?: string; retopoTaskId?: string } }]
      >
    )[0]?.[0];
    expect(completeArg?.result?.providerTaskId).toBe("task_existing");
    expect(completeArg?.result?.retopoTaskId).toBe("retopo_existing");
    expect(completeArg?.result?.publicUrl).toContain("figurine.glb");
    expect(completeArg?.result?.publicUrl).not.toContain("popout.glb");
  });

  it("submits retopo after generation and downloads only low-poly output", async () => {
    const glb = await tinyGlb();
    let submitCount = 0;
    let retopoCount = 0;
    const downloadedUrls: string[] = [];
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "file_1" }),
      submitImageToModel: async () => {
        submitCount += 1;
        return { providerTaskId: "gen_1" };
      },
      submitModelConvert: async () => ({ providerTaskId: "convert_unused" }),
      submitMeshDecimate: async (input) => {
        retopoCount += 1;
        expect(input.sourceTaskId).toBe("gen_1");
        expect(input.faceLimit).toBe(20_000);
        expect(input.bake).toBe(true);
        return { providerTaskId: "retopo_1" };
      },
      getTask: async (id) => {
        if (id === "gen_1") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example.com/hi.glb" };
        }
        if (id === "retopo_1") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example.com/lo.glb" };
        }
        throw new Error(`unexpected ${id}`);
      },
      downloadModel: async (url) => {
        downloadedUrls.push(url);
        return Buffer.from(glb);
      }
    };

    const { storage, write } = memoryStorage();
    const complete = vi.fn(async () => baseJob({ status: "done" }));
    const phases: string[] = [];

    await runFigurineBuildStage(baseJob(), {
      storage,
      provider,
      loadProject: projectLoader(),
      loadSource: async () => png,
      complete: complete as never,
      markProject: async () => undefined,
      inspectSubject: async () => ({
        width: 512,
        height: 512,
        componentCount: 1,
        coverage: 0.2
      }),
      patchProgress: async (p) => {
        if (typeof p.result?.phase === "string") phases.push(p.result.phase);
        return baseJob({ result: p.result });
      },
      sleep: async () => undefined
    });

    expect(submitCount).toBe(1);
    expect(retopoCount).toBe(1);
    expect(downloadedUrls).toEqual(["https://cdn.example.com/lo.glb"]);
    expect(downloadedUrls).not.toContain("https://cdn.example.com/hi.glb");
    expect(write).toHaveBeenCalled();
    expect(phases).toContain("retopologizing");
    expect(phases).toContain("validating");
  });

  it("fails closed on empty retopo download without writing public artifact", async () => {
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "f" }),
      submitImageToModel: async () => ({ providerTaskId: "t1" }),
      submitModelConvert: async () => ({ providerTaskId: "convert_unused" }),
      submitMeshDecimate: async () => ({ providerTaskId: "r1" }),
      getTask: async (id) => ({
        status: "success",
        progress: 100,
        modelUrl:
          id === "r1" ? "https://cdn.example.com/lo.glb" : "https://cdn.example.com/hi.glb"
      }),
      downloadModel: async () => Buffer.alloc(0)
    };
    const { storage, write } = memoryStorage();

    await expect(
      runFigurineBuildStage(baseJob(), {
        storage,
        provider,
        loadProject: projectLoader(),
        loadSource: async () => png,
        inspectSubject: async () => ({
          width: 512,
          height: 512,
          componentCount: 1,
          coverage: 0.2
        }),
        patchProgress: async (p) => baseJob({ result: p.result }),
        sleep: async () => undefined
      })
    ).rejects.toMatchObject({ code: "TRIPO_DOWNLOAD_EMPTY" });

    expect(write).not.toHaveBeenCalled();
  });

  it("fails closed when retopo provider task fails and does not download high-poly", async () => {
    const downloadedUrls: string[] = [];
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "f" }),
      submitImageToModel: async () => ({ providerTaskId: "t1" }),
      submitModelConvert: async () => ({ providerTaskId: "convert_unused" }),
      submitMeshDecimate: async () => ({ providerTaskId: "r_fail" }),
      getTask: async (id) => {
        if (id === "t1") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example.com/hi.glb" };
        }
        return {
          status: "failed",
          progress: 0,
          errorCode: "RETOPO_FAIL",
          errorMessage: "retopo failed"
        };
      },
      downloadModel: async (url) => {
        downloadedUrls.push(url);
        return Buffer.from([1, 2, 3]);
      }
    };
    const { storage, write } = memoryStorage();

    await expect(
      runFigurineBuildStage(baseJob(), {
        storage,
        provider,
        loadProject: projectLoader(),
        loadSource: async () => png,
        inspectSubject: async () => ({
          width: 512,
          height: 512,
          componentCount: 1,
          coverage: 0.2
        }),
        patchProgress: async (p) => baseJob({ result: p.result }),
        sleep: async () => undefined
      })
    ).rejects.toMatchObject({ code: "RETOPO_FAIL" });

    expect(downloadedUrls).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects multi-subject before provider when componentCount > 1", async () => {
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => {
        throw new Error("must not upload");
      },
      submitImageToModel: async () => {
        throw new Error("must not submit");
      },
      submitModelConvert: async () => ({ providerTaskId: "convert_unused" }),
      submitMeshDecimate: async () => {
        throw new Error("must not retopo");
      },
      getTask: async () => ({ status: "queued", progress: 0 }),
      downloadModel: async () => Buffer.alloc(0)
    };
    const { storage } = memoryStorage();

    await expect(
      runFigurineBuildStage(baseJob(), {
        storage,
        provider,
        loadProject: projectLoader(),
        loadSource: async () => png,
        inspectSubject: async () => ({
          width: 800,
          height: 600,
          componentCount: 3,
          coverage: 0.4
        })
      })
    ).rejects.toMatchObject({ code: "MULTI_SUBJECT" });
  });
});
