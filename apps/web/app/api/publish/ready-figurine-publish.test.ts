import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end (local, mocked services) for publishing a figurine that was already generated.
 * Uses the REAL figurine / publish / project routes, the REAL enqueueJob / findJobByInputHash /
 * listProjectJobsWindow and the REAL hash, plan and reuse functions. Only the Appwrite client
 * (an in-memory fake), auth and the storage factory are mocked: no network, no worker, no
 * provider, no storage writes.
 */

const state = vi.hoisted(() => ({
  costVerified: false,
  user: { $id: "user1", prefs: {} as Record<string, unknown> }
}));

vi.mock("@/lib/appwrite/config", () => ({
  APPWRITE_DATABASE_ID: "db",
  APPWRITE_JOBS_COLLECTION: "jobs",
  APPWRITE_SOURCE_BUCKET: "source-test"
}));
vi.mock("@/lib/appwrite/client", () => ({
  getLoggedInUser: vi.fn(async () => state.user),
  createAdminClient: vi.fn()
}));
vi.mock("@/lib/appwrite/db", () => ({
  getProjectForOwner: vi.fn(),
  updateProjectDocument: vi.fn(),
  deleteProjectDocument: vi.fn()
}));
vi.mock("@/lib/appwrite/storage", () => ({
  APPWRITE_ASSETS_BUCKET: "assets",
  APPWRITE_SOURCE_BUCKET: "source",
  createSignedAssetUrl: vi.fn(),
  createSignedSourceUrl: vi.fn(),
  deleteStorageFiles: vi.fn()
}));
vi.mock("@/lib/ai/moderation", () => ({
  moderateText: vi.fn(async () => ({ ok: true, flagged: false }))
}));
vi.mock("@/lib/figurine-cost", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/figurine-cost")>()),
  // Lets the pre-gate behavior be observed; the production default stays unverified.
  verifyFigurineCost: () => ({ status: state.costVerified ? "verified" : "unverified" })
}));
vi.mock("@kidar/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kidar/core")>()),
  createPublicArtifactStorage: vi.fn(() => ({
    getPublicUrl: (key: string) => `https://cdn.example.com/${key}`
  }))
}));

import {
  arePageRenderDependenciesSatisfied,
  figurineArtifactKey,
  figurinePipelineLabel,
  publicUrlFromJob,
  resolvePageRenderDependsOn
} from "@kidar/core";
import { createAdminClient } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { mapJobDocument } from "@/lib/appwrite/jobs";
import { withConsent } from "@/lib/consent";
import { pickFigurineModelUrl } from "@/components/studio-personalize-preview/generate-figurine";
import { planProjectPublish, publishContentHash } from "@/lib/publish-identity";
import { POST as publish } from "@/app/api/publish/route";
import { GET as figurineStatus, POST as figurineStart } from "@/app/api/projects/[projectId]/figurine/route";
import { PATCH as patchProject } from "@/app/api/projects/[projectId]/route";

const SETTINGS = { title: "Dragon", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } };

type Doc = Record<string, unknown> & { $id: string };
let docs: Doc[] = [];
let project: Record<string, unknown>;
let updates: Array<Record<string, unknown>> = [];
let fetchSpy: ReturnType<typeof vi.fn>;
let seq = 0;

function installFakeAppwrite() {
  docs = [];
  seq = 0;
  const databases = {
    listDocuments: vi.fn(async (_db: string, _coll: string, queries: unknown[]) => {
      const filters = queries
        .map((q) => {
          try {
            return JSON.parse(String(q)) as { method: string; attribute?: string; values: unknown[] };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{ method: string; attribute?: string; values: unknown[] }>;
      const equals = filters.filter((f) => f.method === "equal");
      const limit = Number(filters.find((f) => f.method === "limit")?.values?.[0] ?? 25);
      const documents = docs
        .filter((d) => equals.every((f) => d[String(f.attribute)] === f.values[0]))
        .slice()
        .reverse()
        .slice(0, limit);
      return { documents, total: documents.length };
    }),
    createDocument: vi.fn(async (_db: string, _coll: string, id: string, data: Record<string, unknown>) => {
      seq += 1;
      const stamp = new Date(Date.UTC(2026, 1, 1, 10, 0, seq)).toISOString();
      const doc = { $id: `${id}-${seq}`, $createdAt: stamp, $updatedAt: stamp, ...data } as Doc;
      docs.push(doc);
      return doc;
    })
  };
  vi.mocked(createAdminClient).mockReturnValue({ databases } as never);
  vi.mocked(getProjectForOwner).mockImplementation(async () => project as never);
  vi.mocked(updateProjectDocument).mockImplementation(async (_id, patch) => {
    updates.push(patch as Record<string, unknown>);
    project = { ...project, ...(patch as Record<string, unknown>) };
    return project as never;
  });
}

const figurineDocs = () => docs.filter((d) => d.step === "figurine_build");
const docsOf = (step: string) => docs.filter((d) => d.step === step);
const payloadOf = (doc: Doc) => JSON.parse(String(doc.payload)) as Record<string, unknown>;
const allJobs = () => docs.map((d) => mapJobDocument(d as never));

/** What the worker does on success: job -> done with its result, project -> ready + model URL. */
function simulateWorkerCompletion(doc: Doc) {
  const inputHash = String(payloadOf(doc).input_hash);
  const key = figurineArtifactKey("proj1", inputHash);
  const modelUrl = `https://cdn.example.com/${key}`;
  doc.status = "done";
  doc.payload = JSON.stringify({
    ...payloadOf(doc),
    artifact_hash: "artifact-sha",
    result: {
      kind: "figurine.glb",
      publicUrl: modelUrl,
      artifactKey: key,
      pipeline: figurinePipelineLabel(),
      phase: "ready",
      progress: 100,
      subjectId: "primary"
    }
  });
  const settings = project.settings as Record<string, unknown>;
  project = {
    ...project,
    status: "ready",
    settings: {
      ...settings,
      figurineModelUrl: modelUrl,
      figurineSubjects: [
        { id: "primary", sourceFileId: "user1/proj1/source.png", status: "ready", progress: 100, modelUrl }
      ]
    }
  };
  return modelUrl;
}

function req(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
const ctx = { params: { projectId: "proj1" } };
const startFigurine = (body: unknown) => figurineStart(req("/api/projects/proj1/figurine", "POST", body), ctx);
const publishProject = (extra: Record<string, unknown> = {}) =>
  publish(req("/api/publish", "POST", { projectId: "proj1", acceptTerms: true, ...extra }));
const pub = () => project as Parameters<typeof publishContentHash>[0];

describe("publishing a figurine that was already generated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("FIGURE_GENERATION_ENABLED", "true");
    vi.stubEnv("FIGURE_PUBLISH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kidar.example");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    fetchSpy = vi.fn(async () => {
      throw new Error("unexpected outbound fetch (provider/worker/moderation)");
    });
    vi.stubGlobal("fetch", fetchSpy);
    state.costVerified = false;
    state.user = { $id: "user1", prefs: {} };
    updates = [];
    project = {
      id: "proj1",
      owner: "user1",
      name: "Dragon",
      slug: "dragon",
      mode: "popout",
      source_image_path: "user1/proj1/source.png",
      glb_path: null,
      mind_path: null,
      status: "draft",
      settings: { ...SETTINGS }
    };
    installFakeAppwrite();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** Generate through the real route (cost gate opened only inside this test file), then finish it. */
  async function generateAndComplete() {
    state.costVerified = true;
    const response = await startFigurine({ confirm: true });
    expect(response.status).toBe(200);
    state.costVerified = false;
    expect(figurineDocs()).toHaveLength(1);
    const doc = figurineDocs()[0]!;
    const generatedHash = String(payloadOf(doc).input_hash);
    const modelUrl = simulateWorkerCompletion(doc);
    return { generatedHash, doc, modelUrl };
  }

  it("1) the figurine route hashes generation BEFORE the model URL exists", async () => {
    const { generatedHash, modelUrl } = await generateAndComplete();
    expect(generatedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(project.mode).toBe("figurine_3d");
    expect((project.settings as Record<string, unknown>).figurineModelUrl).toBe(modelUrl);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("2) after the worker sets figurineModelUrl, the publish hash is a different hash — only because of that field", async () => {
    const { generatedHash, modelUrl } = await generateAndComplete();
    const publishHash = publishContentHash(pub());
    expect(publishHash).not.toBe(generatedHash);

    const { figurineModelUrl: _drop, ...withoutUrl } = project.settings as Record<string, unknown>;
    expect(publishContentHash({ ...pub(), settings: withoutUrl as never })).toBe(generatedHash);
    expect(
      publishContentHash({ ...pub(), settings: { ...withoutUrl, title: "Alt titlu" } as never })
    ).not.toBe(generatedHash);

    const plan = planProjectPublish(pub(), publishHash, process.env);
    expect(plan.jobs).toContain("figurine_build");
    expect(plan.dependsOn.figurine_build).toBe(publishHash);
    expect(plan.publicModelUrl).toBe(modelUrl);
  });

  it("3) UI/project say 'ready' while the job lookup by the publish hash finds nothing", async () => {
    const { modelUrl } = await generateAndComplete();
    const response = await figurineStatus(req("/api/projects/proj1/figurine", "GET"), ctx);
    const body = await response.json();
    expect(body.figurineModelUrl).toBe(modelUrl);
    expect(body.subjects[0]).toMatchObject({ status: "ready", modelUrl });
    expect(body.job).toBeNull();
    expect(pickFigurineModelUrl(body)).toBe(modelUrl);
  });

  it("4) with the cost gate open (future), publish still enqueues figurine_build exactly as before", async () => {
    const { generatedHash } = await generateAndComplete();
    state.costVerified = true;
    const response = await publishProject();
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.jobs[0]).toMatchObject({ type: "figurine_build", enqueue: "created" });
    expect(figurineDocs()).toHaveLength(2);
    expect(String(payloadOf(figurineDocs()[1]!).input_hash)).not.toBe(generatedHash);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("5) with the unverified gate, the ready figurine is published by REUSING the finished job (no new figurine_build)", async () => {
    const { generatedHash, modelUrl } = await generateAndComplete();
    const response = await publishProject();
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.jobs[0]).toMatchObject({ type: "figurine_build", enqueue: "reused" });

    expect(figurineDocs()).toHaveLength(1); // still only the original generation
    expect(docsOf("mind_compile")).toHaveLength(1);
    expect(docsOf("page_render")).toHaveLength(1);

    const publishHash = publishContentHash(pub());
    expect(String(payloadOf(docsOf("mind_compile")[0]!).input_hash)).toBe(publishHash);
    const pageJob = allJobs().find((job) => job.type === "page_render")!;
    expect(pageJob.dependsOn).toEqual({ figurine_build: generatedHash, mind_compile: publishHash });

    // The worker's own dependency logic is satisfied by the reused job once mind_compile is done.
    const dependsOn = resolvePageRenderDependsOn("figurine_3d", pageJob);
    expect(arePageRenderDependenciesSatisfied(dependsOn, allJobs())).toBe(false); // mind not done yet
    const mind = docsOf("mind_compile")[0]!;
    mind.status = "done";
    mind.payload = JSON.stringify({ ...payloadOf(mind), result: { publicUrl: "https://cdn.example.com/x.mind" } });
    expect(arePageRenderDependenciesSatisfied(dependsOn, allJobs())).toBe(true);
    expect(publicUrlFromJob(allJobs(), "figurine_build", dependsOn.figurine_build!)).toBe(modelUrl);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("6) retrying the publish is idempotent: no duplicate jobs, still no figurine_build", async () => {
    await generateAndComplete();
    expect((await publishProject()).status).toBe(202);
    const afterFirst = docs.length;
    expect((await publishProject()).status).toBe(409); // project is now `processing` (existing publish guard)
    expect(docs).toHaveLength(afterFirst);

    project = { ...project, status: "ready" };
    expect((await publishProject()).status).toBe(202);
    expect(docs).toHaveLength(afterFirst); // mind_compile/page_render already exist for this hash
    expect(figurineDocs()).toHaveLength(1);
  });

  it("7) an edit after generation is refused with cost_unverified, never regenerated implicitly", async () => {
    await generateAndComplete();
    project = { ...project, settings: { ...(project.settings as object), title: "Alt titlu" } };
    const jobsBefore = docs.length;
    const updatesBefore = updates.length;
    const response = await publishProject();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("cost_unverified");
    expect(docs).toHaveLength(jobsBefore);
    expect(updates).toHaveLength(updatesBefore);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("8) a replaced source image is refused: no proof the job belongs to the current source", async () => {
    await generateAndComplete();
    project = { ...project, source_image_path: "user1/proj1/new-source.png" };
    const jobsBefore = docs.length;
    expect((await publishProject()).status).toBe(409);
    expect(docs).toHaveLength(jobsBefore);
  });

  it("9) figurineModelUrl is owner-writable via PATCH but is not an authority for publish", async () => {
    const { generatedHash } = await generateAndComplete();

    for (const value of ["https://evil.example/models/other.glb", null]) {
      const res = await patchProject(
        req("/api/projects/proj1", "PATCH", { settings: { figurineModelUrl: value } }),
        ctx
      );
      expect(res.status).toBe(200);
      expect((project.settings as Record<string, unknown>).figurineModelUrl).toBe(value);
      project = { ...project, status: "ready" };
      docs = docs.filter((d) => d.step === "figurine_build");
      const response = await publishProject();
      expect(response.status).toBe(202);
      const pageJob = allJobs().find((job) => job.type === "page_render")!;
      // Always the server-verified job, never the owner-written URL.
      expect(pageJob.dependsOn?.figurine_build).toBe(generatedHash);
      expect(figurineDocs()).toHaveLength(1);
    }
  });

  it("10) with no finished job at all, publish answers cost_unverified with zero side effects", async () => {
    project = { ...project, mode: "figurine_3d" };
    const response = await publishProject();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("cost_unverified");
    expect(docs).toHaveLength(0);
    expect(updates).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("11) a finished job pushed out of the worker's 50-job window is not reused", async () => {
    await generateAndComplete();
    // 50 newer jobs of the same project push the figurine job out of the newest-50 window.
    for (let i = 0; i < 50; i += 1) {
      docs.push({
        $id: `filler-${i}`,
        $createdAt: new Date(Date.UTC(2026, 2, 1, 0, 0, i)).toISOString(),
        $updatedAt: new Date(Date.UTC(2026, 2, 1, 0, 0, i)).toISOString(),
        project_id: "proj1",
        step: "mind_compile",
        status: "done",
        attempt: 1,
        max_attempts: 3,
        payload: JSON.stringify({ input_hash: String(i).padStart(64, "0"), result: { publicUrl: "x" } })
      });
    }
    const before = docs.length;
    const response = await publishProject();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("cost_unverified");
    expect(docs).toHaveLength(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("12) text-to-3D generations cannot be proven against the project source and are refused", async () => {
    vi.stubEnv("FIGURE_TEXT_3D_ENABLED", "true");
    state.user = { $id: "user1", prefs: withConsent({}, "ai") };
    state.costVerified = true;
    const response = await startFigurine({ confirm: true, mode: "text", prompt: "un dragon prietenos" });
    expect(response.status).toBe(200);
    state.costVerified = false;
    simulateWorkerCompletion(figurineDocs()[0]!);

    const jobsBefore = docs.length;
    const publishResponse = await publishProject();
    expect(publishResponse.status).toBe(409);
    expect(docs).toHaveLength(jobsBefore);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("13) a regeneration chain publishes the newest generated model", async () => {
    const first = await generateAndComplete();
    // Regenerate: the route hashes the project while it already holds the first model URL.
    project = { ...project, status: "ready" };
    state.costVerified = true;
    expect((await startFigurine({ confirm: true })).status).toBe(200);
    state.costVerified = false;
    const secondDoc = figurineDocs()[1]!;
    expect(String(payloadOf(secondDoc).input_hash)).not.toBe(first.generatedHash);
    const secondHash = String(payloadOf(secondDoc).input_hash);
    simulateWorkerCompletion(secondDoc);

    const response = await publishProject();
    expect(response.status).toBe(202);
    expect(figurineDocs()).toHaveLength(2);
    const pageJob = allJobs().find((job) => job.type === "page_render")!;
    expect(pageJob.dependsOn?.figurine_build).toBe(secondHash);
  });
});
