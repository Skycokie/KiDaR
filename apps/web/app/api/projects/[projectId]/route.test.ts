import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({ getLoggedInUser: vi.fn() }));
vi.mock("@/lib/appwrite/db", () => ({
  deleteProjectDocument: vi.fn(),
  getProjectForOwner: vi.fn(),
  updateProjectDocument: vi.fn()
}));
vi.mock("@/lib/appwrite/storage", () => ({
  APPWRITE_ASSETS_BUCKET: "assets",
  APPWRITE_SOURCE_BUCKET: "source",
  createSignedAssetUrl: vi.fn(),
  createSignedSourceUrl: vi.fn(),
  deleteStorageFiles: vi.fn()
}));

import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { PATCH } from "@/app/api/projects/[projectId]/route";

const settings = { title: "Cocoș", theme: "#6d5dfc", scale: 1, offset: { x: 0, y: 0, z: 0 } };

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/projects/proj1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: { projectId: "proj1" } }
  );
}

describe("PATCH /api/projects/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue({ id: "proj1", owner: "user1", settings } as never);
    vi.mocked(updateProjectDocument).mockImplementation(async (_id, data) => data as never);
  });

  it("persists decor through the scene patch", async () => {
    const response = await patch({
      settings: { scene: { decor: [{ id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 }] } }
    });
    expect(response.status).toBe(200);
    const written = vi.mocked(updateProjectDocument).mock.calls[0]?.[1] as {
      settings: { scene: { decor: unknown[] } };
    };
    expect(written.settings.scene.decor).toEqual([{ id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 }]);
  });

  it("rejects unknown decor ids", async () => {
    const response = await patch({ settings: { scene: { decor: [{ id: "cloud", x: 1, y: 1 }] } } });
    expect(response.status).toBe(400);
    expect(updateProjectDocument).not.toHaveBeenCalled();
  });

  it("ignores client writes to server-owned publish fields", async () => {
    await patch({
      settings: {
        title: "Nou",
        publicExperienceUrl: "https://evil.example/ar/x",
        publicQrUrl: "https://evil.example/qr.png",
        publishTermsAcceptedAt: "2020-01-01T00:00:00.000Z"
      }
    });
    const written = vi.mocked(updateProjectDocument).mock.calls[0]?.[1] as {
      settings: Record<string, unknown>;
    };
    expect(written.settings.title).toBe("Nou");
    expect(written.settings).not.toHaveProperty("publicExperienceUrl");
    expect(written.settings).not.toHaveProperty("publicQrUrl");
    expect(written.settings).not.toHaveProperty("publishTermsAcceptedAt");
  });
});
