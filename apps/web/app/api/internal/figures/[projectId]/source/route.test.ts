import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({
  getLoggedInUser: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/appwrite/db", () => ({
  getProjectForOwner: vi.fn()
}));

vi.mock("@/lib/staging-runtime", () => ({
  isStagingRuntime: vi.fn()
}));

import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { isStagingRuntime } from "@/lib/staging-runtime";
import { GET } from "@/app/api/internal/figures/[projectId]/source/route";

describe("GET /api/internal/figures/:projectId/source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 with Cache-Control no-store when not staging", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/internal/figures/p1/source"), {
      params: { projectId: "p1" }
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getLoggedInUser).not.toHaveBeenCalled();
  });

  it("returns 401 when staging but no session", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(true);
    vi.mocked(getLoggedInUser).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/internal/figures/p1/source"), {
      params: { projectId: "p1" }
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when owner mismatch or missing source", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(true);
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/internal/figures/proj1/source"),
      { params: { projectId: "proj1" } }
    );
    expect(response.status).toBe(404);
  });

  it("returns image bytes with no-store when owner and source exist", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(true);
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue({
      id: "proj1",
      source_image_path: "file123"
    } as never);
    const bytes = Buffer.from([0xff, 0xd8, 0xff]);
    vi.mocked(createAdminClient).mockReturnValue({
      storage: {
        getFileDownload: vi.fn().mockResolvedValue(bytes),
        getFile: vi.fn().mockResolvedValue({ mimeType: "image/jpeg" })
      }
    } as never);

    const response = await GET(
      new Request("http://localhost/api/internal/figures/proj1/source"),
      { params: { projectId: "proj1" } }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(bytes)).toBe(true);
  });
});
