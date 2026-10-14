import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({ getLoggedInUser: vi.fn() }));
vi.mock("@/lib/appwrite/db", () => ({
  getProjectForOwner: vi.fn(),
  updateProjectDocument: vi.fn()
}));
vi.mock("@/lib/appwrite/jobs", () => ({
  enqueueJob: vi.fn(),
  findJobByInputHash: vi.fn()
}));
vi.mock("@kidar/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kidar/core")>()),
  createPublicArtifactStorage: vi.fn()
}));

import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob, findJobByInputHash } from "@/lib/appwrite/jobs";
import { POST } from "@/app/api/publish/route";
import { GET as STATUS } from "@/app/api/projects/[projectId]/publish/route";

const project = (overrides: Record<string, unknown> = {}) => ({
  id: "proj1",
  owner: "user1",
  name: "Cocoș",
  slug: "cocos",
  mode: "popout",
  source_image_path: "user1/proj1/source.png",
  mind_path: null,
  glb_path: null,
  status: "draft",
  settings: {
    title: "Cocoș",
    theme: "#6d5dfc",
    scale: 1,
    offset: { x: 0, y: 0, z: 0 },
    scene: { decor: [{ id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 }] }
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides
});

function publishRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("FIGURE_PUBLISH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kidar.example");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue(project() as never);
    vi.mocked(updateProjectDocument).mockResolvedValue(project() as never);
    vi.mocked(enqueueJob).mockImplementation(async (params) => ({
      kind: "queued",
      job: { id: `job-${params.type}`, status: "queued" }
    }) as never);
  });

  it("returns 401 without a session and never enqueues", async () => {
    vi.mocked(getLoggedInUser).mockResolvedValue(null as never);
    const response = await POST(publishRequest({ projectId: "proj1", acceptTerms: true }));
    expect(response.status).toBe(401);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("returns 404 for a project the user does not own", async () => {
    vi.mocked(getProjectForOwner).mockResolvedValue(null as never);
    const response = await POST(publishRequest({ projectId: "other", acceptTerms: true }));
    expect(response.status).toBe(404);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("refuses when the publish flag is off", async () => {
    vi.stubEnv("FIGURE_PUBLISH_ENABLED", "false");
    const response = await POST(publishRequest({ projectId: "proj1", acceptTerms: true }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "flag_off" });
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("requires acceptTerms === true server-side", async () => {
    for (const acceptTerms of [undefined, false, "true", 1]) {
      const response = await POST(publishRequest({ projectId: "proj1", acceptTerms }));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "terms" });
    }
    expect(enqueueJob).not.toHaveBeenCalled();
    expect(updateProjectDocument).not.toHaveBeenCalled();
  });

  it("blocks a second publish while one is processing", async () => {
    vi.mocked(getProjectForOwner).mockResolvedValue(project({ status: "processing" }) as never);
    const response = await POST(publishRequest({ projectId: "proj1", acceptTerms: true }));
    expect(response.status).toBe(409);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("records consent, enqueues the real jobs, and marks the project processing", async () => {
    const response = await POST(publishRequest({ projectId: "proj1", acceptTerms: true }));
    expect(response.status).toBe(202);
    const types = vi.mocked(enqueueJob).mock.calls.map(([params]) => params.type);
    expect(types).toEqual(["popout_build", "mind_compile", "page_render"]);
    const [consentCall, statusCall] = vi.mocked(updateProjectDocument).mock.calls;
    expect(consentCall?.[1]).toMatchObject({
      settings: { publishTermsAcceptedAt: expect.any(String) }
    });
    expect(statusCall?.[1]).toEqual({ status: "processing" });
    const body = JSON.stringify(await response.json());
    expect(body).not.toMatch(/SECRET|AKIA|signature=/i);
  });

  it("status polls the same job hashes that publish enqueued (decor included)", async () => {
    await POST(publishRequest({ projectId: "proj1", acceptTerms: true }));
    const enqueued = vi.mocked(enqueueJob).mock.calls.map(([params]) => params.inputHash);
    vi.mocked(findJobByInputHash).mockResolvedValue(null as never);
    await STATUS(new Request("http://localhost/api/projects/proj1/publish"), {
      params: { projectId: "proj1" }
    });
    const polled = vi.mocked(findJobByInputHash).mock.calls.map(([params]) => params.inputHash);
    expect(polled).toEqual(enqueued);

    vi.mocked(enqueueJob).mockClear();
    vi.mocked(getProjectForOwner).mockResolvedValue(
      project({
        settings: {
          ...project().settings,
          scene: { decor: [{ id: "tree", x: 20, y: 40, yaw: 90, pitch: 0 }] }
        }
      }) as never
    );
    await POST(publishRequest({ projectId: "proj1", acceptTerms: true }));
    const moved = vi.mocked(enqueueJob).mock.calls.map(([params]) => params.inputHash);
    expect(moved[2]).not.toBe(enqueued[2]);
    expect(moved[0]).toBe(enqueued[0]);
  });
});

describe("GET /api/projects/:id/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("FIGURE_PUBLISH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kidar.example");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
  });

  const call = () =>
    STATUS(new Request("http://localhost/api/projects/proj1/publish"), {
      params: { projectId: "proj1" }
    });

  it("returns 401 without a session", async () => {
    vi.mocked(getLoggedInUser).mockResolvedValue(null as never);
    expect((await call()).status).toBe(401);
  });

  it("reports building while jobs run and hides the QR", async () => {
    vi.mocked(getProjectForOwner).mockResolvedValue(project() as never);
    vi.mocked(findJobByInputHash).mockResolvedValue({ status: "running", result: {} } as never);
    const body = await (await call()).json();
    expect(body).toMatchObject({ phase: "building", ready: false, qrPath: null, publishEnabled: true });
  });

  it("reports failed with a generic error, never the raw worker message", async () => {
    vi.mocked(getProjectForOwner).mockResolvedValue(project() as never);
    vi.mocked(findJobByInputHash).mockResolvedValue({
      status: "error",
      lastError: "R2 PUT https://acct.r2.cloudflarestorage.com/bucket?X-Amz-Signature=abc failed"
    } as never);
    const body = await (await call()).json();
    expect(body.phase).toBe("failed");
    expect(JSON.stringify(body)).not.toMatch(/cloudflarestorage|Signature/);
  });

  it("is ready only when page_render is done and exposes the owner QR route", async () => {
    vi.mocked(getProjectForOwner).mockResolvedValue(
      project({
        status: "ready",
        settings: {
          ...project().settings,
          publicExperienceUrl: "https://kidar.example/ar/cocos",
          publicPdfUrl: "https://cdn.example.com/pages/proj1/abc/print.pdf"
        }
      }) as never
    );
    vi.mocked(findJobByInputHash).mockResolvedValue({ status: "done" } as never);
    const body = await (await call()).json();
    expect(body).toMatchObject({
      phase: "ready",
      ready: true,
      qrPath: "/api/projects/proj1/qr",
      publicUrls: { experience: "https://kidar.example/ar/cocos" }
    });
  });
});
