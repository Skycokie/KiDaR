import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({ getLoggedInUser: vi.fn() }));
vi.mock("@/lib/appwrite/db", () => ({
  getProjectForOwner: vi.fn(),
  updateProjectDocument: vi.fn()
}));
vi.mock("@/lib/appwrite/jobs", () => ({ enqueueJob: vi.fn(), findJobByInputHash: vi.fn() }));
vi.mock("@/lib/appwrite/config", () => ({ APPWRITE_SOURCE_BUCKET: "source-test" }));

import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob, findJobByInputHash } from "@/lib/appwrite/jobs";
import { withConsent } from "@/lib/consent";
import { startFigurineGeneration } from "@/components/studio-personalize-preview/generate-figurine";
import { GET, POST } from "./route";

const mocks = {
  user: vi.mocked(getLoggedInUser),
  project: vi.mocked(getProjectForOwner),
  update: vi.mocked(updateProjectDocument),
  enqueue: vi.mocked(enqueueJob),
  findJob: vi.mocked(findJobByInputHash)
};

const baseProject = {
  id: "proj1",
  owner: "user1",
  name: "Dragon",
  slug: "dragon",
  mode: "popout",
  source_image_path: "user1/proj1/source.png",
  glb_path: null,
  status: "draft",
  settings: {}
};

function aiUser() {
  return { $id: "user1", prefs: withConsent({}, "ai") };
}

/** Any outbound network call (moderation, provider, worker) would land here. */
function installFetchSpy() {
  const fetchSpy = vi.fn(async () => {
    throw new Error("unexpected outbound fetch");
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/projects/proj1/figurine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: { projectId: "proj1" } }
  );
}

function expectNoSideEffects(fetchSpy: ReturnType<typeof installFetchSpy>) {
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
}

describe("POST /api/projects/[projectId]/figurine — server-side cost gate", () => {
  let fetchSpy: ReturnType<typeof installFetchSpy>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FIGURE_GENERATION_ENABLED", "true");
    vi.stubEnv("FIGURE_TEXT_3D_ENABLED", "");
    fetchSpy = installFetchSpy();
    mocks.user.mockResolvedValue(aiUser() as never);
    mocks.project.mockResolvedValue({ ...baseProject } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses a valid confirm:true request with cost_unverified and no side effects", async () => {
    const response = await post({ confirm: true });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("cost_unverified");
    expect(JSON.stringify(body)).not.toMatch(/gratuit|free|price|pret|preț|credit|€|\$/i);
    expectNoSideEffects(fetchSpy);
    expect(mocks.findJob).not.toHaveBeenCalled();
  });

  it("does not let client-sent fields bypass the block", async () => {
    const response = await post({
      confirm: true,
      costVerified: true,
      verified: true,
      cost: { status: "verified" },
      credits: 999,
      free: true,
      force: true,
      subjectId: "primary"
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("cost_unverified");
    expectNoSideEffects(fetchSpy);
  });

  it("a client that claims a verified cost is still refused by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/projects/proj1/figurine");
        return POST(new Request(`http://localhost${String(input)}`, init), {
          params: { projectId: "proj1" }
        });
      })
    );
    const result = await startFigurineGeneration("proj1", { status: "verified" } as never);
    expect(result).toEqual({ ok: false, error: "cost_unverified" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("refuses text mode before moderation, writes or enqueue", async () => {
    vi.stubEnv("FIGURE_TEXT_3D_ENABLED", "true");
    const response = await post({ confirm: true, mode: "text", prompt: "un dragon prietenos" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("cost_unverified");
    expectNoSideEffects(fetchSpy);
  });

  it("refuses even when the project already has a figurine model or an active subject", async () => {
    mocks.project.mockResolvedValue({
      ...baseProject,
      settings: {
        figurineModelUrl: "https://cdn.example.com/models/p/h/figurine.glb",
        figurineSubjects: [{ id: "primary", sourceFileId: "x", status: "running", progress: 40 }]
      }
    } as never);
    const response = await post({ confirm: true });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("cost_unverified");
    expectNoSideEffects(fetchSpy);
  });

  describe("existing checks keep their behavior and precedence", () => {
    it("401 without a session", async () => {
      mocks.user.mockResolvedValue(null as never);
      const response = await post({ confirm: true });
      expect(response.status).toBe(401);
      expect(mocks.project).not.toHaveBeenCalled();
      expectNoSideEffects(fetchSpy);
    });

    it("403 generation_disabled when the flag is off", async () => {
      vi.stubEnv("FIGURE_GENERATION_ENABLED", "");
      vi.stubEnv("FIGURINE_3D_ENABLED", "");
      const response = await post({ confirm: true });
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe("generation_disabled");
      expectNoSideEffects(fetchSpy);
    });

    it("404 for a project the user does not own", async () => {
      mocks.project.mockResolvedValue(null as never);
      const response = await post({ confirm: true });
      expect(response.status).toBe(404);
      expectNoSideEffects(fetchSpy);
    });

    it.each([{}, { confirm: false }, { confirm: "true" }, { confirm: 1 }])(
      "400 confirmation_required for %j",
      async (payload) => {
        const response = await post(payload);
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("confirmation_required");
        expectNoSideEffects(fetchSpy);
      }
    );

    it("403 text_3d_disabled when text mode is off", async () => {
      const response = await post({ confirm: true, mode: "text", prompt: "dragon" });
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe("text_3d_disabled");
      expectNoSideEffects(fetchSpy);
    });

    it("403 consent_required for text mode without AI consent", async () => {
      vi.stubEnv("FIGURE_TEXT_3D_ENABLED", "true");
      mocks.user.mockResolvedValue({ $id: "user1", prefs: {} } as never);
      const response = await post({ confirm: true, mode: "text", prompt: "dragon" });
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe("consent_required");
      expectNoSideEffects(fetchSpy);
    });
  });
});

describe("GET /api/projects/[projectId]/figurine — read-only status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FIGURE_GENERATION_ENABLED", "true");
    mocks.user.mockResolvedValue(aiUser() as never);
    mocks.project.mockResolvedValue({
      ...baseProject,
      settings: { title: "Dragon", theme: "forest", scale: 1, offset: { x: 0, y: 0, z: 0 } }
    } as never);
    mocks.findJob.mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("still answers without writing or enqueueing", async () => {
    const response = await GET(new Request("http://localhost/api/projects/proj1/figurine"), {
      params: { projectId: "proj1" }
    });
    expect(response.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
