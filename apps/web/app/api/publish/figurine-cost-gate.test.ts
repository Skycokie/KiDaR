import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({ getLoggedInUser: vi.fn() }));
vi.mock("@/lib/appwrite/db", () => ({
  getProjectForOwner: vi.fn(),
  updateProjectDocument: vi.fn()
}));
vi.mock("@/lib/appwrite/jobs", () => ({
  enqueueJob: vi.fn(),
  findJobByInputHash: vi.fn(),
  listProjectJobsWindow: vi.fn()
}));
vi.mock("@kidar/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kidar/core")>()),
  createPublicArtifactStorage: vi.fn()
}));

import {
  createPublicArtifactStorage,
  figurineArtifactKey,
  figurinePipelineLabel,
  type PipelineJob
} from "@kidar/core";
import { jobInputHashForType } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob, findJobByInputHash, listProjectJobsWindow } from "@/lib/appwrite/jobs";
import { POST } from "@/app/api/publish/route";
import { pageRenderIdentityFor, publishContentHash } from "@/lib/publish-identity";

const CDN = "https://cdn.example.com";
const publicUrlForKey = (key: string) => `${CDN}/${key}`;

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj1",
    owner: "user1",
    name: "Dragon",
    slug: "dragon",
    mode: "figurine_3d",
    source_image_path: "user1/proj1/source.png",
    mind_path: null,
    glb_path: null,
    status: "draft",
    settings: { title: "Dragon", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const asProjectArg = (p: ReturnType<typeof project>) => p as Parameters<typeof publishContentHash>[0];

/** Hash the generation job had: the project as it was, before the worker wrote the model URL. */
function generationHash(p = project(), figurineModelUrl?: string) {
  return publishContentHash(asProjectArg({ ...p, settings: { ...p.settings, figurineModelUrl } } as never));
}

function figurineJob(overrides: Partial<PipelineJob> = {}, id = "job-fig"): PipelineJob {
  const inputHash = overrides.inputHash ?? generationHash();
  const key = figurineArtifactKey("proj1", inputHash);
  return {
    id,
    projectId: "proj1",
    type: "figurine_build",
    status: "done",
    attempt: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: null,
    lockToken: null,
    lastError: null,
    inputHash,
    artifactHash: "artifact-sha",
    result: {
      kind: "figurine.glb",
      publicUrl: publicUrlForKey(key),
      artifactKey: key,
      pipeline: figurinePipelineLabel(),
      phase: "ready"
    },
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:05:00.000Z",
    ...overrides
  } as PipelineJob;
}

function otherJob(i: number): PipelineJob {
  return figurineJob(
    { type: "page_render", inputHash: String(i).padStart(64, "0"), result: null, artifactHash: null },
    `filler-${i}`
  );
}

function publishRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: "proj1", acceptTerms: true, ...body })
  });
}

const mocks = {
  user: vi.mocked(getLoggedInUser),
  project: vi.mocked(getProjectForOwner),
  update: vi.mocked(updateProjectDocument),
  enqueue: vi.mocked(enqueueJob),
  findJob: vi.mocked(findJobByInputHash),
  window: vi.mocked(listProjectJobsWindow),
  storage: vi.mocked(createPublicArtifactStorage)
};

describe("POST /api/publish — figurine reuse and cost gate", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  const expectNoSideEffects = () => {
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("FIGURE_PUBLISH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kidar.example");
    vi.stubEnv("R2_PUBLIC_BASE_URL", CDN);
    fetchSpy = vi.fn(async () => {
      throw new Error("unexpected outbound fetch");
    });
    vi.stubGlobal("fetch", fetchSpy);
    mocks.user.mockResolvedValue({ $id: "user1" } as never);
    mocks.project.mockResolvedValue(project() as never);
    mocks.update.mockResolvedValue(project() as never);
    mocks.window.mockResolvedValue([]);
    mocks.storage.mockReturnValue({ getPublicUrl: publicUrlForKey } as never);
    mocks.enqueue.mockImplementation(async (params) => ({
      kind: "created",
      job: { id: `job-${params.type}`, status: "queued" }
    }) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("refuses with cost_unverified and zero side effects", () => {
    it("when there is no finished model", async () => {
      const response = await POST(publishRequest());
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toBe("cost_unverified");
      expect(JSON.stringify(body)).not.toMatch(/gratuit|free|price|pret|preț|credit|€|\$/i);
      expectNoSideEffects();
      expect(mocks.window).toHaveBeenCalledTimes(1);
      expect(mocks.findJob).not.toHaveBeenCalled();
    });

    it.each([
      ["queued", { status: "queued" }],
      ["running", { status: "running" }],
      ["error", { status: "error" }],
      ["from another project", { projectId: "other-project" }],
      ["without artifactHash", { artifactHash: null }],
      ["with a mismatched hash", { inputHash: "d".repeat(64) }]
    ])("when the only figurine job is %s", async (_label, overrides) => {
      mocks.window.mockResolvedValue([figurineJob(overrides as Partial<PipelineJob>)]);
      const response = await POST(publishRequest());
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("cost_unverified");
      expectNoSideEffects();
    });

    it.each([
      ["a foreign publicUrl", { publicUrl: "https://evil.example/models/proj1/x/figurine.glb" }],
      ["an artifactKey that does not match projectId + hash", { artifactKey: "models/proj1/abc/figurine.glb" }],
      ["another pipeline version", { pipeline: "figurine@figurine-tripo-v0" }],
      ["a wrong kind", { kind: "popout.glb" }]
    ])("when the result has %s", async (_label, patch) => {
      const base = figurineJob();
      mocks.window.mockResolvedValue([{ ...base, result: { ...base.result, ...patch } } as PipelineJob]);
      const response = await POST(publishRequest());
      expect(response.status).toBe(409);
      expectNoSideEffects();
    });

    it("when the valid job is outside the worker's 50-job window", async () => {
      // The newest 50 jobs of the project are all unrelated; the finished figurine job is older.
      mocks.window.mockResolvedValue(Array.from({ length: 50 }, (_, i) => otherJob(i)));
      const response = await POST(publishRequest());
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("cost_unverified");
      expectNoSideEffects();
    });

    it("when the project source changed after generation", async () => {
      mocks.window.mockResolvedValue([figurineJob()]);
      mocks.project.mockResolvedValue(project({ source_image_path: "user1/proj1/new-source.png" }) as never);
      expect((await POST(publishRequest())).status).toBe(409);
      expectNoSideEffects();
    });

    it("when a hashed setting changed after generation (no implicit regeneration)", async () => {
      mocks.window.mockResolvedValue([figurineJob()]);
      mocks.project.mockResolvedValue(
        project({ settings: { ...project().settings, title: "Alt titlu" } }) as never
      );
      expect((await POST(publishRequest())).status).toBe(409);
      expectNoSideEffects();
    });

    it("when the lookup itself fails (no partial effects)", async () => {
      mocks.window.mockRejectedValue(new Error("appwrite down"));
      const response = await POST(publishRequest());
      expect(response.status).toBe(500);
      expectNoSideEffects();
    });

    it("regardless of client fields or owner-writable settings", async () => {
      mocks.project.mockResolvedValue(
        project({
          settings: {
            ...project().settings,
            figurineModelUrl: `${CDN}/models/proj1/zzz/figurine.glb`,
            figurineSubjects: [{ id: "primary", status: "ready", progress: 100, modelUrl: `${CDN}/x.glb` }]
          }
        }) as never
      );
      const response = await POST(
        publishRequest({
          confirm: true,
          costVerified: true,
          verified: true,
          credits: 999,
          free: true,
          status: "ready",
          force: true,
          figurineModelUrl: `${CDN}/models/proj1/zzz/figurine.glb`
        })
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("cost_unverified");
      expectNoSideEffects();
    });
  });

  describe("reuses a proven finished model", () => {
    const publishHashOf = (p = project()) => publishContentHash(asProjectArg(p));

    it("creates no figurine_build and points page_render at the verified job's hash", async () => {
      const finished = figurineJob();
      // Like production after the worker finished: the project now carries the model URL.
      const afterWorker = project({
        status: "ready",
        settings: { ...project().settings, figurineModelUrl: finished.result?.publicUrl }
      });
      mocks.project.mockResolvedValue(afterWorker as never);
      mocks.window.mockResolvedValue([finished]);

      const response = await POST(publishRequest());
      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.jobs[0]).toMatchObject({ type: "figurine_build", enqueue: "reused" });

      const calls = mocks.enqueue.mock.calls.map(([params]) => params);
      expect(calls.map((c) => c.type)).toEqual(["mind_compile", "page_render"]);

      const publishHash = publishHashOf(afterWorker);
      expect(publishHash).not.toBe(finished.inputHash);
      const mind = calls[0]!;
      const page = calls[1]!;
      // mind_compile and page_render stay on the CURRENT publish hash...
      expect(mind.inputHash).toBe(publishHash);
      expect(page.inputHash).toBe(
        jobInputHashForType("page_render", publishHash, pageRenderIdentityFor(asProjectArg(afterWorker), process.env))
      );
      // ...while page_render depends on exactly the verified figurine job.
      expect(page.payload?.dependsOn).toEqual({
        figurine_build: finished.inputHash,
        mind_compile: publishHash
      });
      expect(mind.payload?.dependsOn).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("ignores a foreign figurineModelUrl in settings (not an authority)", async () => {
      const finished = figurineJob();
      mocks.project.mockResolvedValue(
        project({ settings: { ...project().settings, figurineModelUrl: "https://evil.example/m.glb" } }) as never
      );
      mocks.window.mockResolvedValue([finished]);
      const response = await POST(publishRequest());
      expect(response.status).toBe(202);
      const page = mocks.enqueue.mock.calls.map(([p]) => p).find((p) => p.type === "page_render");
      expect((page?.payload?.dependsOn as { figurine_build: string }).figurine_build).toBe(finished.inputHash);
    });

    it("chooses the newest of several proven jobs, whatever the order", async () => {
      const first = figurineJob({ createdAt: "2026-02-01T10:00:00.000Z" }, "job-1");
      const secondHash = generationHash(project(), String(first.result?.publicUrl));
      const second = figurineJob({ inputHash: secondHash, createdAt: "2026-02-02T10:00:00.000Z" }, "job-2");
      const settings = { ...project().settings, figurineModelUrl: second.result?.publicUrl };
      mocks.project.mockResolvedValue(project({ settings }) as never);

      for (const order of [[first, second], [second, first]]) {
        mocks.enqueue.mockClear();
        mocks.window.mockResolvedValue(order);
        expect((await POST(publishRequest())).status).toBe(202);
        const page = mocks.enqueue.mock.calls.map(([p]) => p).find((p) => p.type === "page_render");
        expect((page?.payload?.dependsOn as { figurine_build: string }).figurine_build).toBe(secondHash);
      }
    });

    it("retry is idempotent: same selection, same hashes, still no figurine_build", async () => {
      mocks.window.mockResolvedValue([figurineJob()]);
      await POST(publishRequest());
      const first = mocks.enqueue.mock.calls.map(([p]) => p);
      mocks.enqueue.mockClear();
      mocks.enqueue.mockImplementation(async (params) => ({
        kind: "idempotent_done",
        job: { id: `job-${params.type}`, status: "done" }
      }) as never);
      const response = await POST(publishRequest());
      expect(response.status).toBe(202);
      expect((await response.json()).enqueue).toBe("idempotent_done");
      const second = mocks.enqueue.mock.calls.map(([p]) => p);
      expect(second).toEqual(first);
      expect(second.map((c) => c.type)).not.toContain("figurine_build");
    });
  });

  describe("other modes and earlier checks are unchanged", () => {
    it("popout, gallery and upload never look up figurine jobs", async () => {
      const cases: Array<[string, Record<string, unknown>, string[]]> = [
        ["popout", {}, ["popout_build", "mind_compile", "page_render"]],
        ["gallery", { galleryModelUrl: `${CDN}/g.glb` }, ["mind_compile", "page_render"]],
        ["upload", { uploadModelUrl: `${CDN}/u.glb` }, ["mind_compile", "page_render"]]
      ];
      for (const [mode, extra, types] of cases) {
        mocks.enqueue.mockClear();
        mocks.project.mockResolvedValue(
          project({ mode, settings: { ...project().settings, ...extra } }) as never
        );
        const response = await POST(publishRequest());
        expect(response.status).toBe(202);
        expect(mocks.enqueue.mock.calls.map(([p]) => p.type)).toEqual(types);
      }
      expect(mocks.window).not.toHaveBeenCalled();
    });

    it("401 without a session", async () => {
      mocks.user.mockResolvedValue(null as never);
      expect((await POST(publishRequest())).status).toBe(401);
      expect(mocks.window).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it("400 without projectId", async () => {
      const response = await POST(
        new Request("http://localhost/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptTerms: true })
        })
      );
      expect(response.status).toBe(400);
      expectNoSideEffects();
    });

    it("404 for a project the user does not own", async () => {
      mocks.project.mockResolvedValue(null as never);
      expect((await POST(publishRequest())).status).toBe(404);
      expect(mocks.window).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it("403 flag_off when publish is disabled", async () => {
      vi.stubEnv("FIGURE_PUBLISH_ENABLED", "false");
      const response = await POST(publishRequest());
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "flag_off" });
      expect(mocks.window).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it("403 terms unless acceptTerms === true", async () => {
      for (const acceptTerms of [undefined, false, "true", 1]) {
        const response = await POST(publishRequest({ acceptTerms }));
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: "terms" });
      }
      expect(mocks.window).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it("409 not_ready while a publish or generation is processing", async () => {
      mocks.project.mockResolvedValue(project({ status: "processing" }) as never);
      const response = await POST(publishRequest());
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "not_ready" });
      expect(mocks.window).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it("plan validation (invalid figurine URL) still answers before the cost gate", async () => {
      mocks.project.mockResolvedValue(
        project({ settings: { ...project().settings, figurineModelUrl: "http://insecure.example/x.glb" } }) as never
      );
      const response = await POST(publishRequest());
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect((await response.json()).error).not.toBe("cost_unverified");
      expect(mocks.window).not.toHaveBeenCalled();
      expectNoSideEffects();
    });
  });
});
