import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECOR_ASSETS } from "./fixtures";
import { DECOR_GLB_SRC, DECOR_GLB_AVAILABLE, decorGlbAvailable } from "./decor-assets";

const iconsSource = readFileSync(join(__dirname, "decor-preview-icons.tsx"), "utf8");
const posterSource = readFileSync(join(__dirname, "garden-poster.tsx"), "utf8");

describe("Studio Decor Meshy GLB", () => {
  it("maps decor prop ids to local path strings without advertising missing binaries", () => {
    expect(DECOR_ASSETS.map((a) => a.id)).toEqual([
      "stars",
      "grass",
      "tree",
      "house",
      "balloons",
      "figureWave",
      "figureFloat",
      "figureDance",
      "figureJump",
      "figureStill",
      "figureFollow"
    ]);
    for (const asset of DECOR_ASSETS) {
      expect(DECOR_GLB_SRC[asset.id].startsWith("/demo/glb/")).toBe(true);
      // Release ships without raw Meshy binaries until storage is approved.
      expect(decorGlbAvailable(asset.id)).toBe(false);
    }
    expect(DECOR_GLB_AVAILABLE.size).toBe(0);
    expect(decorGlbAvailable("cloud")).toBe(false);
    expect(decorGlbAvailable("planet")).toBe(false);
  });

  it("uses pending CSS when GLB is unavailable and filters stage props by availability", () => {
    expect(iconsSource).toMatch(/decorGlbAvailable/);
    expect(iconsSource).toMatch(/studio-ws__asset-icon--pending/);
    expect(iconsSource).toMatch(/ModeGlbThumb/);
    expect(posterSource).toMatch(/decorGlbAvailable\(item\.id\)/);
    expect(posterSource).toMatch(/StageGlbProp/);
    expect(posterSource).not.toMatch(/DECOR_ASSET_SRC/);
  });
});
