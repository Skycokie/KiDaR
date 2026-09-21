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

describe("figurine_build stage", () => {
  it("reuses providerTaskId and does not submit twice", async () => {
    const glb = await tinyGlb();
    let submitCount = 0;
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => {
        throw new Error("should not upload when providerTaskId exists");
      },
      submitImageToModel: async () => {
        submitCount += 1;
        return { providerTaskId: "task_dup" };
      },
      getTask: async () => ({
        status: "success",
        progress: 100,
        modelUrl: "https://cdn.example.com/out.glb"
      }),
      downloadModel: async () => Buffer.from(glb)
    };

    const written = new Map<string, { checksum?: string; size?: number }>();
    const storage: PublicArtifactStorage = {
      provider: "r2",
      async write(input) {
        written.set(input.key, { checksum: input.checksum, size: input.body.byteLength });
        return { key: input.key, publicUrl: `https://ar.example.com/${input.key}` };
      },
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

    const patches: unknown[] = [];
    const complete = vi.fn(async () => baseJob({ status: "done" }));
    const markProject = vi.fn(async () => undefined);

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);

    await runFigurineBuildStage(
      baseJob({
        result: { providerTaskId: "task_existing", subjectId: "primary" }
      }),
      {
        storage,
        provider,
        loadProject: async () => ({
          sourceImagePath: "src1",
          mode: "figurine_3d",
          slug: "s",
          settings: { title: "", theme: "#000", scale: 1, offset: { x: 0, y: 0, z: 0 } },
          settingsRaw: "{}"
        }),
        loadSource: async () => png,
        complete: complete as never,
        markProject: markProject as never,
        inspectSubject: async () => ({
          width: 512,
          height: 512,
          componentCount: 1,
          coverage: 0.2
        }),
        patchProgress: async (p) => {
          patches.push(p.result);
          return baseJob({ result: p.result });
        },
        sleep: async () => undefined,
        providerTimeoutMs: 5_000
      }
    );

    expect(submitCount).toBe(0);
    expect(complete).toHaveBeenCalled();
    const completeArg = (complete.mock.calls as unknown as Array<[{ result?: { publicUrl?: string; providerTaskId?: string } }]>)[0]?.[0];
    expect(completeArg?.result?.providerTaskId).toBe("task_existing");
    expect(completeArg?.result?.publicUrl).toContain("figurine.glb");
    expect(completeArg?.result?.publicUrl).not.toContain("popout.glb");
    expect(completeArg?.result?.publicUrl).not.toMatch(/source-drawings/);
  });

  it("fails closed on empty download without writing public artifact", async () => {
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "f" }),
      submitImageToModel: async () => ({ providerTaskId: "t1" }),
      getTask: async () => ({
        status: "success",
        progress: 100,
        modelUrl: "https://cdn.example.com/out.glb"
      }),
      downloadModel: async () => Buffer.alloc(0)
    };
    const write = vi.fn();
    const storage: PublicArtifactStorage = {
      provider: "r2",
      write: write as never,
      async exists() {
        return false;
      },
      getPublicUrl(key) {
        return `https://ar.example.com/${key}`;
      },
      async getMetadata() {
        return null;
      }
    };
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await expect(
      runFigurineBuildStage(baseJob(), {
        storage,
        provider,
        loadProject: async () => ({
          sourceImagePath: "src1",
          mode: "figurine_3d",
          slug: "s",
          settings: { title: "", theme: "#000", scale: 1, offset: { x: 0, y: 0, z: 0 } },
          settingsRaw: "{}"
        }),
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

  it("rejects multi-subject before provider when componentCount > 1", async () => {
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => {
        throw new Error("must not upload");
      },
      submitImageToModel: async () => {
        throw new Error("must not submit");
      },
      getTask: async () => ({ status: "queued", progress: 0 }),
      downloadModel: async () => Buffer.alloc(0)
    };
    const storage: PublicArtifactStorage = {
      provider: "r2",
      async write() {
        throw new Error("must not write");
      },
      async exists() {
        return false;
      },
      getPublicUrl(key) {
        return `https://ar.example.com/${key}`;
      },
      async getMetadata() {
        return null;
      }
    };
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await expect(
      runFigurineBuildStage(baseJob(), {
        storage,
        provider,
        loadProject: async () => ({
          sourceImagePath: "src1",
          mode: "figurine_3d",
          slug: "s",
          settings: { title: "", theme: "#000", scale: 1, offset: { x: 0, y: 0, z: 0 } },
          settingsRaw: "{}"
        }),
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
