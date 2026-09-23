import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/client", () => ({
  getLoggedInUser: vi.fn()
}));

vi.mock("@/lib/appwrite/db", () => ({
  getProjectForOwner: vi.fn()
}));

vi.mock("@/lib/staging-runtime", () => ({
  isStagingRuntime: vi.fn()
}));

vi.mock("@/lib/staging-r2-presign", () => ({
  assertStagingRuntimeForFigures: vi.fn(),
  resolveStagingR2PresignConfig: vi.fn(),
  presignFigureAssetGets: vi.fn()
}));

import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { isStagingRuntime } from "@/lib/staging-runtime";
import {
  assertStagingRuntimeForFigures,
  presignFigureAssetGets,
  resolveStagingR2PresignConfig
} from "@/lib/staging-r2-presign";
import { GET } from "@/app/api/internal/figures/[projectId]/route";

describe("GET /api/internal/figures/:projectId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 with Cache-Control no-store when not staging", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/internal/figures/p1"), {
      params: { projectId: "p1" }
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/R2_|SECRET|AKIA/i);
  });

  it("returns status without URLs when assets are not ready", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(true);
    vi.mocked(assertStagingRuntimeForFigures).mockImplementation(() => undefined);
    vi.mocked(resolveStagingR2PresignConfig).mockReturnValue({
      accountId: "a",
      accessKeyId: "k",
      secretAccessKey: "s",
      bucket: "kidar-figures-staging",
      endpoint: "https://a.r2.cloudflarestorage.com"
    });
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue({
      id: "proj1",
      name: "Cocoș",
      settings: {
        figureAssets: {
          projectId: "proj1",
          status: "processing",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:01:00.000Z"
        }
      }
    } as never);

    const response = await GET(new Request("http://localhost/api/internal/figures/proj1"), {
      params: { projectId: "proj1" }
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.status).toBe("processing");
    expect(body.glbUrl).toBeUndefined();
    expect(body.usdzUrl).toBeUndefined();
    expect(presignFigureAssetGets).not.toHaveBeenCalled();
  });

  it("presigns only server-derived keys when ready", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(true);
    vi.mocked(assertStagingRuntimeForFigures).mockImplementation(() => undefined);
    vi.mocked(resolveStagingR2PresignConfig).mockReturnValue({
      accountId: "a",
      accessKeyId: "k",
      secretAccessKey: "s",
      bucket: "kidar-figures-staging",
      endpoint: "https://a.r2.cloudflarestorage.com"
    });
    vi.mocked(getLoggedInUser).mockResolvedValue({ $id: "user1" } as never);
    vi.mocked(getProjectForOwner).mockResolvedValue({
      id: "proj1",
      name: "Cocoș",
      settings: {
        figureAssets: {
          projectId: "proj1",
          status: "ready",
          jobId: "job_abc",
          glbKey: "staging/projects/proj1/figures/job_abc/model.glb",
          usdzKey: "staging/projects/proj1/figures/job_abc/model.usdz",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:02:00.000Z"
        }
      }
    } as never);
    vi.mocked(presignFigureAssetGets).mockResolvedValue({
      glbUrl: "https://a.r2.cloudflarestorage.com/kidar-figures-staging/staging/projects/proj1/figures/job_abc/model.glb?X-Amz-Signature=g",
      usdzUrl:
        "https://a.r2.cloudflarestorage.com/kidar-figures-staging/staging/projects/proj1/figures/job_abc/model.usdz?X-Amz-Signature=u",
      expiresAt: "2026-09-23T11:10:00.000Z"
    });

    const response = await GET(new Request("http://localhost/api/internal/figures/proj1"), {
      params: { projectId: "proj1" }
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(presignFigureAssetGets).toHaveBeenCalledWith({
      projectId: "proj1",
      glbKey: "staging/projects/proj1/figures/job_abc/model.glb",
      usdzKey: "staging/projects/proj1/figures/job_abc/model.usdz"
    });
    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(body.glbUrl).toContain("X-Amz-Signature");
    expect(body.usdzUrl).toContain("model.usdz");
    expect(JSON.stringify(body)).not.toMatch(/secretAccessKey|"s"|R2_SECRET/i);
  });

  it("returns 404 for malicious projectId", async () => {
    vi.mocked(isStagingRuntime).mockReturnValue(true);
    vi.mocked(assertStagingRuntimeForFigures).mockImplementation(() => undefined);
    vi.mocked(resolveStagingR2PresignConfig).mockReturnValue({
      accountId: "a",
      accessKeyId: "k",
      secretAccessKey: "s",
      bucket: "kidar-figures-staging",
      endpoint: "https://a.r2.cloudflarestorage.com"
    });
    const response = await GET(new Request("http://localhost/api/internal/figures/a%2F..%2Fb"), {
      params: { projectId: "a%2F..%2Fb" }
    });
    expect(response.status).toBe(404);
    expect(getProjectForOwner).not.toHaveBeenCalled();
  });
});
