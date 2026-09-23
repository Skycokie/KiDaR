import { describe, expect, it, vi } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import type { FigureGenerationJob, PublicArtifactStorage } from "@kidar/core";
import { runFigureStagingBuild } from "./staging-stage";
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

function memoryStorage(): {
  storage: PublicArtifactStorage;
  written: Map<string, Uint8Array>;
} {
  const written = new Map<string, Uint8Array>();
  const storage: PublicArtifactStorage = {
    provider: "r2",
    async write(input) {
      written.set(input.key, input.body);
      return { key: input.key, publicUrl: `https://staging.example/${input.key}` };
    },
    async exists(key) {
      return written.has(key);
    },
    getPublicUrl(key) {
      return `https://staging.example/${key}`;
    },
    async getMetadata(key) {
      const body = written.get(key);
      return body
        ? { key, size: body.byteLength, contentType: "application/octet-stream", checksum: "x" }
        : null;
    }
  };
  return { storage, written };
}

function baseJob(overrides: Partial<FigureGenerationJob> = {}): FigureGenerationJob {
  return {
    jobId: "job_abc",
    environment: "staging",
    projectId: "proj1",
    sourceImageUrl: "https://signed.example/source.png",
    requestedFormats: ["glb", "usdz"],
    requestedBy: "internal",
    ...overrides
  };
}

const stagingEnv = {
  R2_BUCKET: "kidar-figures-staging",
  R2_STAGING_BUCKET: "kidar-figures-staging",
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: "appwrite-staging",
  KIDAR_PRODUCTION_APPWRITE_PROJECT_ID: "appwrite-prod",
  TRIPO_API_KEY: "test"
};

describe("figure staging build", () => {
  it("refuses production Appwrite / non-staging bucket", async () => {
    const { storage } = memoryStorage();
    await expect(
      runFigureStagingBuild(baseJob(), {
        storage,
        env: {
          ...stagingEnv,
          R2_BUCKET: "kidar-prod",
          R2_STAGING_BUCKET: "kidar-staging"
        },
        loadSource: async () => new Uint8Array([1]),
        provider: {} as TripoImageToModelProvider
      })
    ).rejects.toMatchObject({ code: "STAGING_GUARD" });
  });

  it("writes staging GLB+USDZ keys and is idempotent on retry", async () => {
    const glb = await tinyGlb();
    const usdz = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
    let imageToModel = 0;
    let convertCount = 0;
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "f1" }),
      submitImageToModel: async () => {
        imageToModel += 1;
        return { providerTaskId: "task_1" };
      },
      submitMeshDecimate: async () => ({ providerTaskId: "retopo_1" }),
      submitModelConvert: async () => {
        convertCount += 1;
        return { providerTaskId: "convert_1" };
      },
      getTask: async (id) => {
        if (id === "task_1") return { status: "success", progress: 100 };
        if (id === "retopo_1") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example/lo.glb" };
        }
        if (id === "convert_1") {
          return { status: "success", progress: 100, modelUrl: "https://cdn.example/model.usdz" };
        }
        throw new Error(id);
      },
      downloadModel: async (url) => {
        if (url.endsWith(".usdz")) return Buffer.from(usdz);
        return Buffer.from(glb);
      }
    };

    const { storage, written } = memoryStorage();
    const persist = vi.fn(async () => undefined);
    const first = await runFigureStagingBuild(baseJob(), {
      storage,
      provider,
      env: stagingEnv,
      loadSource: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]),
      persistAssets: persist,
      sleep: async () => undefined,
      providerTimeoutMs: 5_000,
      retopoTimeoutMs: 5_000,
      convertTimeoutMs: 5_000
    });

    expect(first.kind).toBe("written");
    expect(first.glbKey).toBe("staging/projects/proj1/figures/job_abc/model.glb");
    expect(first.usdzKey).toBe("staging/projects/proj1/figures/job_abc/model.usdz");
    expect(written.has(first.glbKey)).toBe(true);
    expect(written.has(first.usdzKey)).toBe(true);
    expect(first.assets.status).toBe("ready");
    expect(first.assets.glbKey).toContain("model.glb");
    expect(first.assets.usdzKey).toContain("model.usdz");
    expect(first.assets).not.toHaveProperty("previewGlbUrl");
    expect(imageToModel).toBe(1);
    expect(convertCount).toBe(1);

    const second = await runFigureStagingBuild(baseJob(), {
      storage,
      provider,
      env: stagingEnv,
      loadSource: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      priorTaskIds: {
        providerTaskId: "task_1",
        retopoTaskId: "retopo_1",
        convertTaskId: "convert_1"
      },
      sleep: async () => undefined
    });
    expect(second.kind).toBe("idempotent");
    expect(imageToModel).toBe(1);
    expect(convertCount).toBe(1);
    expect([...written.keys()].filter((k) => k.includes("model.glb")).length).toBe(1);
  });

  it("does not write production figurine keys", async () => {
    const glb = await tinyGlb();
    const usdz = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9]);
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "f1" }),
      submitImageToModel: async () => ({ providerTaskId: "t" }),
      submitMeshDecimate: async () => ({ providerTaskId: "r" }),
      submitModelConvert: async () => ({ providerTaskId: "c" }),
      getTask: async (id) => ({
        status: "success",
        progress: 100,
        modelUrl:
          id === "c" ? "https://cdn.example/model.usdz" : "https://cdn.example/lo.glb"
      }),
      downloadModel: async (url) =>
        url.endsWith(".usdz") ? Buffer.from(usdz) : Buffer.from(glb)
    };
    const { storage, written } = memoryStorage();
    await runFigureStagingBuild(baseJob(), {
      storage,
      provider,
      env: stagingEnv,
      loadSource: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      sleep: async () => undefined,
      providerTimeoutMs: 5_000
    });
    for (const key of written.keys()) {
      expect(key.startsWith("staging/")).toBe(true);
      expect(key).not.toContain("figurine.glb");
      expect(key).not.toMatch(/^models\//);
    }
  });
});
