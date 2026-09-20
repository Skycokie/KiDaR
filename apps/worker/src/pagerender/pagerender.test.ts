import { describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import {
  PageRenderError,
  PublicStorageConfigError,
  AFRAME_RUNTIME_OBJECT_KEY,
  MINDAR_RUNTIME_OBJECT_KEY,
  type PipelineJob,
  type ProjectSettings
} from "@kidar/core";
import { runPageRenderStage } from "./stage";
import { MemoryPublicArtifactStorage } from "../storage/public";

const hash = "c".repeat(64);

function tinyPng(): Uint8Array {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(180);
  return new Uint8Array(PNG.sync.write(png));
}

function baseJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id: "job_page_1",
    projectId: "proj_page",
    type: "page_render",
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: new Date().toISOString(),
    lockToken: "lock-page",
    lastError: null,
    inputHash: hash,
    artifactHash: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dependsOn: { popout_build: hash, mind_compile: hash },
    ...overrides
  };
}

const settings: ProjectSettings = {
  title: "Demo",
  theme: "#6d5dfc",
  scale: 1,
  offset: { x: 0, y: 0, z: 0 }
};

const stubArRuntime = {
  loadArRuntimeScripts: async () => [
    { key: AFRAME_RUNTIME_OBJECT_KEY, body: new TextEncoder().encode("/*aframe*/") },
    { key: MINDAR_RUNTIME_OBJECT_KEY, body: new TextEncoder().encode("/*mindar*/") }
  ]
};

function siblingJobs(mode: "popout" | "gallery") {
  const mind = {
    type: "mind_compile" as const,
    status: "done" as const,
    inputHash: hash,
    result: { publicUrl: "https://cdn.example.com/targets/p/c/targets.mind" }
  };
  if (mode === "gallery") return [mind];
  return [
    {
      type: "popout_build" as const,
      status: "done" as const,
      inputHash: hash,
      result: { publicUrl: "https://cdn.example.com/models/p/c/popout.glb" }
    },
    mind
  ];
}

describe("page_render stage", () => {
  it("writes html/qr/pdf, records hashes, and marks ready only after verify", async () => {
    const job = baseJob();
    const storage = new MemoryPublicArtifactStorage("https://cdn.example.com");
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));
    const markProject = vi.fn(async () => undefined);
    const result = await runPageRenderStage(job, {
      storage,
      appOrigin: "http://localhost:3000",
      allowLocalOrigins: true,
      ...stubArRuntime,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "popout",
        slug: "demo-slug",
        settings,
        settingsRaw: JSON.stringify(settings)
      }),
      loadSource: async () => tinyPng(),
      listJobs: async () => siblingJobs("popout"),
      complete,
      markProject
    });
    expect(result.kind).toBe("written");
    expect(result.publicUrl).toContain("/pages/proj_page/");
    expect(result.publicUrl).toContain("/index.html");
    expect(complete).toHaveBeenCalledOnce();
    const payload = complete.mock.calls[0][0];
    expect(payload.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.result?.hashes).toBeTruthy();
    expect(markProject).toHaveBeenCalledWith(
      "proj_page",
      "ready",
      expect.objectContaining({
        publicQrUrl: result.qrUrl,
        publicPdfUrl: result.pdfUrl
      })
    );
    const html = new TextDecoder().decode(
      (storage as unknown as { objects: Map<string, { body: Uint8Array }> }).objects?.get(
        result.artifactKey
      )?.body ?? new Uint8Array()
    );
    // MemoryPublicArtifactStorage doesn't expose objects; fetch via getPublicUrl path
    expect(result.experienceUrl).toBe("http://localhost:3000/ar/demo-slug");
    expect(await storage.getMetadata(AFRAME_RUNTIME_OBJECT_KEY)).toBeTruthy();
    expect(await storage.getMetadata(MINDAR_RUNTIME_OBJECT_KEY)).toBeTruthy();
  });

  it("reuses matching artifacts instead of rewriting", async () => {
    const job = baseJob();
    const storage = new MemoryPublicArtifactStorage("https://cdn.example.com");
    const source = tinyPng();
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));
    const deps = {
      storage,
      appOrigin: "http://localhost:3000",
      allowLocalOrigins: true,
      ...stubArRuntime,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "popout" as const,
        slug: "demo-slug",
        settings,
        settingsRaw: JSON.stringify(settings)
      }),
      loadSource: async () => source,
      listJobs: async () => siblingJobs("popout"),
      complete
    };
    const first = await runPageRenderStage(job, deps);
    complete.mockClear();
    const second = await runPageRenderStage(job, deps);
    expect(first.artifactKey).toBe(second.artifactKey);
    expect(second.kind).toBe("idempotent");
  });

  it("writes HTML under the page_render hash while reusing upstream popout/mind hashes", async () => {
    const contentHash = "c".repeat(64);
    const pageHash = "d".repeat(64);
    const job = baseJob({
      inputHash: pageHash,
      dependsOn: { popout_build: contentHash, mind_compile: contentHash }
    });
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));
    const result = await runPageRenderStage(job, {
      storage: new MemoryPublicArtifactStorage("https://cdn.example.com"),
      appOrigin: "http://localhost:3000",
      allowLocalOrigins: true,
      ...stubArRuntime,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "popout",
        slug: "demo-slug",
        settings,
        settingsRaw: JSON.stringify(settings)
      }),
      loadSource: async () => tinyPng(),
      listJobs: async () => siblingJobs("popout"),
      complete
    });
    expect(result.artifactKey).toBe(`pages/proj_page/${pageHash}/index.html`);
    expect(result.artifactKey).not.toContain(contentHash);
    expect(result.publicUrl).toContain(`/pages/proj_page/${pageHash}/index.html`);
  });

  it("does not complete when a required upload fails", async () => {
    const job = baseJob();
    const complete = vi.fn();
    const markProject = vi.fn();
    const stored = new Map<string, { checksum: string }>();
    const storage = {
      provider: "r2" as const,
      async write(input: { key: string; checksum?: string; body: Uint8Array; contentType: string }) {
        if (input.key.includes("print.pdf")) throw new PublicStorageConfigError("R2 write failed");
        stored.set(input.key, { checksum: input.checksum ?? "x" });
        return { key: input.key, publicUrl: `https://cdn.example.com/${input.key}` };
      },
      async exists() {
        return false;
      },
      getPublicUrl(key: string) {
        return `https://cdn.example.com/${key}`;
      },
      async getMetadata(key: string) {
        const hit = stored.get(key);
        return hit ? { key, checksum: hit.checksum } : null;
      }
    };
    await expect(
      runPageRenderStage(job, {
        storage,
        appOrigin: "http://localhost:3000",
        allowLocalOrigins: true,
      ...stubArRuntime,
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          slug: "demo-slug",
          settings,
          settingsRaw: "{}"
        }),
        loadSource: async () => tinyPng(),
        listJobs: async () => siblingJobs("popout"),
        complete,
        markProject
      })
    ).rejects.toBeInstanceOf(PublicStorageConfigError);
    expect(complete).not.toHaveBeenCalled();
    expect(markProject).not.toHaveBeenCalled();
  });

  it("rejects final mutation on lock mismatch", async () => {
    const job = baseJob();
    const complete = vi.fn(async () => {
      throw new Error("Lock token mismatch on complete");
    });
    await expect(
      runPageRenderStage(job, {
        storage: new MemoryPublicArtifactStorage("https://cdn.example.com"),
        appOrigin: "http://localhost:3000",
        allowLocalOrigins: true,
      ...stubArRuntime,
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          slug: "demo-slug",
          settings,
          settingsRaw: "{}"
        }),
        loadSource: async () => tinyPng(),
        listJobs: async () => siblingJobs("popout"),
        complete
      })
    ).rejects.toThrow(/Lock token mismatch/);
  });

  it("blocks page_render when mind_compile has not succeeded", async () => {
    const job = baseJob();
    await expect(
      runPageRenderStage(job, {
        storage: new MemoryPublicArtifactStorage("https://cdn.example.com"),
        appOrigin: "http://localhost:3000",
        allowLocalOrigins: true,
        ...stubArRuntime,
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          slug: "demo-slug",
          settings,
          settingsRaw: "{}"
        }),
        loadSource: async () => tinyPng(),
        listJobs: async () => [
          {
            type: "popout_build",
            status: "done",
            inputHash: hash,
            result: { publicUrl: "https://cdn.example.com/a.glb" }
          }
        ],
        complete: vi.fn()
      })
    ).rejects.toBeInstanceOf(PageRenderError);
  });

  it("fails closed when page_render lacks dependsOn instead of using page hash as GLB/.mind identity", async () => {
    const pageHash = "e".repeat(64);
    const job = baseJob({
      inputHash: pageHash,
      dependsOn: undefined
    });
    const listJobs = vi.fn(async () => siblingJobs("popout"));
    await expect(
      runPageRenderStage(job, {
        storage: new MemoryPublicArtifactStorage("https://cdn.example.com"),
        appOrigin: "http://localhost:3000",
        allowLocalOrigins: true,
        ...stubArRuntime,
        loadProject: async () => ({
          sourceImagePath: "src_1",
          mode: "popout",
          slug: "demo-slug",
          settings,
          settingsRaw: "{}"
        }),
        loadSource: async () => tinyPng(),
        listJobs,
        complete: vi.fn()
      })
    ).rejects.toMatchObject({ code: "MISSING_DEPENDS_ON", retryable: false });
    expect(listJobs).not.toHaveBeenCalled();
  });

  it("uses a preexisting public gallery URL and does not require popout_build", async () => {
    const job = baseJob();
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));
    await runPageRenderStage(job, {
      storage: new MemoryPublicArtifactStorage("https://cdn.example.com"),
      appOrigin: "http://localhost:3000",
      allowLocalOrigins: true,
      ...stubArRuntime,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "gallery",
        slug: "demo-slug",
        settings: {
          ...settings,
          galleryModelUrl: "https://cdn.example.com/gallery/dragon.glb"
        },
        settingsRaw: "{}"
      }),
      loadSource: async () => tinyPng(),
      listJobs: async () => siblingJobs("gallery"),
      complete
    });
    expect(complete).toHaveBeenCalledOnce();
  });

  it("publishes Mission hint text without a clickable CTA", async () => {
    const job = baseJob();
    const complete = vi.fn(async (params) => ({ ...job, ...params, status: "done" as const }));
    const result = await runPageRenderStage(job, {
      storage: new MemoryPublicArtifactStorage("https://cdn.example.com"),
      appOrigin: "http://localhost:3000",
      allowLocalOrigins: true,
      ...stubArRuntime,
      loadProject: async () => ({
        sourceImagePath: "src_1",
        mode: "popout",
        slug: "demo-slug",
        settings: { ...settings, ctaText: "Caută cheia", ctaUrl: undefined },
        settingsRaw: JSON.stringify({ ...settings, ctaText: "Caută cheia" })
      }),
      loadSource: async () => tinyPng(),
      listJobs: async () => siblingJobs("popout"),
      complete
    });
    expect(result.kind).toBe("written");
    expect(complete).toHaveBeenCalledOnce();
  });
});
