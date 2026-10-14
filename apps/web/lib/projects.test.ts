import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/appwrite/db", () => ({
  createProjectDocument: vi.fn(),
  slugExists: vi.fn()
}));

import { createProjectDocument, slugExists } from "@/lib/appwrite/db";
import { createProjectWithUniqueSlug } from "@/lib/projects";

describe("createProjectWithUniqueSlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips slugs that already exist", async () => {
    const taken = new Set(["cocos", "cocos-2"]);
    vi.mocked(slugExists).mockImplementation(async (slug) => taken.has(slug));
    vi.mocked(createProjectDocument).mockImplementation(async (_owner, data) => data as never);
    const result = await createProjectWithUniqueSlug("user1", "Cocoș");
    expect(result.error).toBeNull();
    expect(vi.mocked(createProjectDocument).mock.calls[0]?.[1]).toMatchObject({ slug: "cocos-3" });
  });

  it("retries when a concurrent create wins the unique index", async () => {
    vi.mocked(slugExists).mockResolvedValue(false);
    vi.mocked(createProjectDocument)
      .mockRejectedValueOnce(new Error("Document with the requested ID already exists"))
      .mockImplementationOnce(async (_owner, data) => data as never);
    const result = await createProjectWithUniqueSlug("user1", "Cocoș");
    expect(result.error).toBeNull();
    expect(createProjectDocument).toHaveBeenCalledTimes(2);
  });

  it("gives up with slug_collision after repeated conflicts", async () => {
    vi.mocked(slugExists).mockResolvedValue(false);
    vi.mocked(createProjectDocument).mockRejectedValue(new Error("409 Conflict"));
    const result = await createProjectWithUniqueSlug("user1", "Cocoș");
    expect(result).toEqual({
      data: null,
      error: { message: "Could not reserve a unique project slug", code: "slug_collision" }
    });
    expect(createProjectDocument).toHaveBeenCalledTimes(24);
  });

  it("does not retry on unrelated failures", async () => {
    vi.mocked(slugExists).mockResolvedValue(false);
    vi.mocked(createProjectDocument).mockRejectedValue(new Error("network down"));
    const result = await createProjectWithUniqueSlug("user1", "Cocoș");
    expect(result.error).toEqual({ message: "network down", code: "create_failed" });
    expect(createProjectDocument).toHaveBeenCalledTimes(1);
  });
});
