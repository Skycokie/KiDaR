import { describe, expect, it } from "vitest";
import {
  canCreateProject,
  canUseWhitelabel,
  generateUniqueSlug,
  mergeSettings,
  slugify,
  validateSceneSettingsPatch,
  type ProjectSettings
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

  it("keeps Simple Creator preset on settings merge", () => {
    const result = mergeSettings(
      {
        title: "Demo",
        theme: "#ff0",
        preset: "story",
        scale: 1,
        offset: { x: 0, y: 0, z: 0 }
      },
      { title: "Poveste" }
    );
    expect(result.preset).toBe("story");
    expect(result.title).toBe("Poveste");
  });

  it("deep-merges scene.startTransform and keeps scene siblings", () => {
    const current = {
      title: "Demo",
      theme: "#ff0",
      scale: 1,
      offset: { x: 1, y: 0, z: 0 },
      scene: {
        lighting: "warm",
        startTransform: {
          rotation: { x: 8, y: -32, z: 180 },
          position: { x: 1, y: 0, z: 0 },
          scale: 1.25
        }
      }
    } as ProjectSettings;
    const result = mergeSettings(current, {
      scene: { startTransform: { rotation: { y: 15 } } }
    });
    expect(result.offset).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.scene).toMatchObject({
      lighting: "warm",
      startTransform: {
        rotation: { x: 8, y: 15, z: 180 },
        position: { x: 1, y: 0, z: 0 },
        scale: 1.25
      }
    });
  });

  it("keeps startTransform when a settings patch omits scene", () => {
    const current = {
      title: "Demo",
      theme: "#ff0",
      scale: 1,
      offset: { x: 0, y: 0, z: 0 },
      scene: {
        startTransform: {
          rotation: { x: 0, y: 0, z: 180 },
          position: { x: 0, y: 0, z: 0 },
          scale: 1
        }
      }
    } as ProjectSettings;
    const result = mergeSettings(current, { title: "Păstrat", offset: { z: 2 } });
    expect(result.title).toBe("Păstrat");
    expect(result.offset).toEqual({ x: 0, y: 0, z: 2 });
    expect(result.scene).toEqual(current.scene);
  });

  it("rejects malformed startTransform and accepts a finite pose", () => {
    expect(validateSceneSettingsPatch(undefined)).toBeNull();
    expect(
      validateSceneSettingsPatch({
        startTransform: {
          rotation: { x: 8, y: -32, z: 180 },
          position: { x: 0, y: 0, z: 0 },
          scale: 1
        }
      })
    ).toBeNull();
    expect(validateSceneSettingsPatch(null)).toMatch(/object/);
    expect(validateSceneSettingsPatch({ startTransform: { rotation: { x: Number.NaN } } })).toMatch(
      /finite/
    );
    expect(
      validateSceneSettingsPatch({ startTransform: { position: { x: 6, y: 0, z: 0 } } })
    ).toMatch(/between -5 and 5/);
    expect(validateSceneSettingsPatch({ startTransform: { scale: 0 } })).toMatch(/\(0, 10\]/);
    expect(validateSceneSettingsPatch({ startTransform: { scale: 11 } })).toMatch(/\(0, 10\]/);
    expect(validateSceneSettingsPatch({ startTransform: "nope" })).toMatch(/object/);
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
