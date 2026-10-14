import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({ getLoggedInUser: vi.fn() }));
vi.mock("@/lib/appwrite/db", () => ({ getProjectForOwner: vi.fn() }));
vi.mock("@kidar/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kidar/core")>()),
  resolveExperienceRedirect: vi.fn(),
  generateArQrPng: vi.fn()
}));

import { generateArQrPng, resolveExperienceRedirect } from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { GET } from "@/app/api/projects/[projectId]/qr/route";

const call = (query = "") =>
  GET(new Request(`http://localhost/api/projects/proj1/qr${query}`), {
    params: { projectId: "proj1" }
  });

describe("GET /api/projects/:id/qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kidar.example");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue({
      id: "proj1",
      owner: "user1",
      slug: "cocos",
      settings: {
        figurineModelUrl: "https://cdn.example.com/models/proj1/abc/figurine.glb"
      }
    } as never);
    vi.mocked(resolveExperienceRedirect).mockResolvedValue({
      ok: true,
      url: "https://cdn.example.com/pages/proj1/abc/index.html"
    });
    vi.mocked(generateArQrPng).mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  });

  it("returns 401 without a session", async () => {
    vi.mocked(getLoggedInUser).mockResolvedValue(null as never);
    expect((await call()).status).toBe(401);
  });

  it("returns 404 for a project the user does not own", async () => {
    vi.mocked(getProjectForOwner).mockResolvedValue(null as never);
    expect((await call()).status).toBe(404);
  });

  it("returns 409 until the public pointer exists", async () => {
    vi.mocked(resolveExperienceRedirect).mockResolvedValue({ ok: false, status: 404 });
    expect((await call()).status).toBe(409);
    expect(generateArQrPng).not.toHaveBeenCalled();
  });

  it("encodes only the public /ar/{slug} page, never the model or R2 URL", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(vi.mocked(generateArQrPng).mock.calls[0]?.[0]).toBe("https://kidar.example/ar/cocos");
    expect(String(vi.mocked(generateArQrPng).mock.calls[0]?.[0])).not.toMatch(/\.glb|cdn\.example/);
  });

  it("serves an attachment for ?download=1", async () => {
    const response = await call("?download=1");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="kidar-cocos-qr.png"'
    );
    expect((await call()).headers.get("Content-Disposition")).toMatch(/^inline;/);
  });
});
