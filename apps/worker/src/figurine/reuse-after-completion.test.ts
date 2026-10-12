import { describe, expect, it, vi } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import type { PipelineJob, PublicArtifactStorage } from "@kidar/core";
import { computeInputHash, sha256Hex } from "@kidar/core/hash";
import { runFigurineBuildStage } from "./stage";
import type { TripoImageToModelProvider } from "../tripo/client";

/**
 * Characterization (no production change): how the worker finds an already generated model.
 * Local only — in-memory storage, fake provider, mocked persistence.
 */

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

function job(inputHash: string, id: string): PipelineJob {
  const now = new Date().toISOString();
  return {
    id,
    projectId: "proj1",
    type: "figurine_build",
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: now,
    lockedAt: now,
    lockToken: "lock-1",
    lastError: null,
    inputHash,
    artifactHash: null,
    result: null,
    createdAt: now,
    updatedAt: now
  };
}

function memoryStorage() {
  const written = new Map<string, { checksum?: string; size?: number }>();
  const storage: PublicArtifactStorage = {
    provider: "r2",
    write: (async (input: { key: string; checksum?: string; body: Uint8Array }) => {
      written.set(input.key, { checksum: input.checksum, size: input.body.byteLength });
      return { key: input.key, publicUrl: `https://ar.example.com/${input.key}` };
    }) as never,
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
  return { storage, written };
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);
const SETTINGS = { title: "Dragon", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } };
const SOURCE = { fileId: "src1", checksum: sha256Hex("appwrite:source:src1") };

describe("figurine_build reuse is keyed by the job's own inputHash", () => {
  it("reuses nothing for a new hash even though the project already has a generated model", async () => {
    const glb = await tinyGlb();
    let tripoSubmits = 0;
    const provider: TripoImageToModelProvider = {
      uploadImage: async () => ({ fileToken: "f" }),
      submitTextToModel: async () => ({ providerTaskId: "text_unused" }),
      submitImageToModel: async () => {
        tripoSubmits += 1;
        return { providerTaskId: `gen_${tripoSubmits}` };
      },
      submitModelConvert: async () => ({ providerTaskId: "convert_unused" }),
      submitMeshDecimate: async () => ({ providerTaskId: "retopo" }),
      getTask: async () => ({ status: "success", progress: 100, modelUrl: "https://cdn.example.com/m.glb" }),
      downloadModel: async () => Buffer.from(glb)
    };
    const { storage, written } = memoryStorage();
    const markProject = vi.fn(async () => undefined);
    const run = (j: PipelineJob, settings: Record<string, unknown>) =>
      runFigurineBuildStage(j, {
        storage,
        provider,
        loadProject: async () =>
          ({
            sourceImagePath: "src1",
            mode: "figurine_3d" as const,
            slug: "s",
            settings,
            settingsRaw: "{}"
          }) as never,
        loadSource: async () => png,
        complete: (async () => job("x", "done")) as never,
        markProject: markProject as never,
        inspectSubject: async () => ({ width: 512, height: 512, componentCount: 1, coverage: 0.2 }),
        patchProgress: async (p) => ({ ...job("x", "p"), result: p.result }),
        sleep: async () => undefined
      });

    // 1) Generation job: hash exactly as the figurine route computes it (no figurineModelUrl yet).
    const generatedHash = computeInputHash({
      projectId: "proj1",
      mode: "figurine_3d",
      source: SOURCE,
      settings: SETTINGS
    });
    const first = await run(job(generatedHash, "gen"), SETTINGS);
    expect(first.kind).toBe("written");
    expect(tripoSubmits).toBe(1);
    expect(written.size).toBe(1);

    // 2) What the worker writes onto the project when the job finishes.
    const patch = (markProject.mock.calls[0] as unknown as [string, string, Record<string, unknown>])[2];
    expect(patch.figurineModelUrl).toBe(first.publicUrl);
    const settingsAfter = { ...SETTINGS, ...patch };

    // 3) Hash a publish of that same project would use: it differs ONLY by figurineModelUrl.
    const publishHash = computeInputHash({
      projectId: "proj1",
      mode: "figurine_3d",
      source: SOURCE,
      settings: settingsAfter as never
    });
    expect(publishHash).not.toBe(generatedHash);
    const withoutModelUrl = { ...settingsAfter } as Record<string, unknown>;
    delete withoutModelUrl.figurineModelUrl;
    expect(
      computeInputHash({
        projectId: "proj1",
        mode: "figurine_3d",
        source: SOURCE,
        settings: withoutModelUrl as never
      })
    ).toBe(generatedHash);

    // 4) A figurine_build for the publish hash finds nothing in storage -> Tripo is called again.
    const second = await run(job(publishHash, "publish"), settingsAfter);
    expect(second.kind).toBe("written");
    expect(tripoSubmits).toBe(2);
    expect(written.size).toBe(2);

    // 5) Control: the original hash is reused with no provider call.
    const third = await run(job(generatedHash, "retry"), SETTINGS);
    expect(third.kind).toBe("idempotent");
    expect(tripoSubmits).toBe(2);
  });
});
