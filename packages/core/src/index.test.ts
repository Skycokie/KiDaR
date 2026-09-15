import { describe, expect, it } from "vitest";
import {
  canCreateProject,
  canUseWhitelabel,
  generateUniqueSlug,
  mergeSettings,
  slugify
} from "./index";

describe("core policies", () => {
  it("enforces plan quotas", () => {
    expect(canCreateProject("free", 2)).toBe(true);
    expect(canCreateProject("free", 3)).toBe(false);
    expect(canCreateProject("paid", 29)).toBe(true);
    expect(canCreateProject("paid", 30)).toBe(false);
  });

  it("restricts whitelabel to paid plans", () => {
    expect(canUseWhitelabel("free")).toBe(false);
    expect(canUseWhitelabel("paid")).toBe(true);
  });

  it("merges nested transform settings", () => {
    const result = mergeSettings(
      {
        title: "Demo",
        theme: "#ff0",
        scale: 1,
        offset: { x: 0, y: 0, z: 0 }
      },
      { offset: { y: 2 } }
    );
    expect(result.offset).toEqual({ x: 0, y: 2, z: 0 });
  });

  it("creates stable URL slugs", () => {
    expect(slugify("  Mărțișor & friends! ")).toBe("martisor-friends");
  });

  it("retries slug collisions without changing the base name", async () => {
    const taken = new Set(["my-drawing", "my-drawing-2"]);
    const slug = await generateUniqueSlug("My Drawing", async (candidate) =>
      taken.has(candidate)
    );
    expect(slug).toBe("my-drawing-3");
  });
});
