import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECOR_ASSETS } from "./fixtures";
import {
  DECOR_MANIFEST,
  DECOR_GLB_AVAILABLE,
  decorGlbAvailable,
  decorGlbSrc
} from "./decor-assets";

const iconsSource = readFileSync(join(__dirname, "decor-preview-icons.tsx"), "utf8");
const posterSource = readFileSync(join(__dirname, "garden-poster.tsx"), "utf8");
const publicDir = join(__dirname, "../../public");

/** Decor props render small, so a prop above this budget would stall the stage. */
const MAX_DECOR_GLB_BYTES = 1_500_000;

/** Ids with no binary anywhere. They must stay out of the manifest. */
const UNAVAILABLE = ["cloud", "planet"] as const;

describe("Studio Decor Meshy GLB", () => {
  it("derives availability from the manifest that ships in public/", () => {
    const served = JSON.parse(
      readFileSync(join(publicDir, "demo/decor/manifest.json"), "utf8")
    );
    expect(DECOR_MANIFEST).toEqual(served);
    expect([...DECOR_GLB_AVAILABLE]).toEqual(DECOR_MANIFEST.assets.map((a) => a.id));
  });

  it("lists every manifest asset as a file that actually exists", () => {
    expect(DECOR_MANIFEST.assets.length).toBeGreaterThan(0);
    for (const asset of DECOR_MANIFEST.assets) {
      expect(asset.src.startsWith("/demo/glb/")).toBe(true);
      const file = join(publicDir, asset.src.replace(/^\//, ""));
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThan(MAX_DECOR_GLB_BYTES);
    }
  });

  it("offers every decor prop in the rail and nothing the manifest omits", () => {
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
      expect(decorGlbAvailable(asset.id)).toBe(true);
      expect(decorGlbSrc(asset.id)).toBe(
        DECOR_MANIFEST.assets.find((a) => a.id === asset.id)?.src
      );
    }
    for (const id of UNAVAILABLE) {
      expect(decorGlbAvailable(id)).toBe(false);
      expect(decorGlbSrc(id)).toBeNull();
    }
  });

  it("ships the Draco decoder the GLB loaders point at", () => {
    const stageSource = readFileSync(join(__dirname, "stage-glb-prop.tsx"), "utf8");
    const thumbSource = readFileSync(join(__dirname, "mode-glb-thumb.tsx"), "utf8");
    for (const source of [stageSource, thumbSource]) {
      expect(source).toMatch(/setDecoderPath\("\/draco\/gltf\/"\)/);
    }
    for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
      expect(existsSync(join(publicDir, "draco/gltf", file))).toBe(true);
    }
  });

  it("falls back to pending CSS when a GLB is missing and keeps it off the stage", () => {
    expect(iconsSource).toMatch(/decorGlbSrc/);
    expect(iconsSource).toMatch(/studio-ws__asset-icon--pending/);
    expect(iconsSource).toMatch(/ModeGlbThumb/);
    expect(posterSource).toMatch(/decorGlbSrc\(item\.id\)/);
    expect(posterSource).toMatch(/StageGlbProp/);
    expect(posterSource).not.toMatch(/DECOR_ASSET_SRC/);
  });
});
