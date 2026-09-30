import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECOR_ASSETS } from "./fixtures";
import { DECOR_GLB_SRC, DECOR_GLB_AVAILABLE, decorGlbAvailable } from "./decor-assets";

const iconsSource = readFileSync(join(__dirname, "decor-preview-icons.tsx"), "utf8");
const posterSource = readFileSync(join(__dirname, "garden-poster.tsx"), "utf8");
const publicDir = join(__dirname, "../../public");

/** Decor props render small, so a prop above this budget would stall the stage. */
const MAX_DECOR_GLB_BYTES = 1_500_000;

describe("Studio Decor Meshy GLB", () => {
  it("offers every decor prop in the rail as an available local GLB", () => {
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
      expect(decorGlbAvailable(asset.id)).toBe(true);
    }
    // cloud/planet have no binary and must never be advertised.
    expect(decorGlbAvailable("cloud")).toBe(false);
    expect(decorGlbAvailable("planet")).toBe(false);
  });

  it("keeps the availability set in sync with the files actually shipped", () => {
    for (const [id, src] of Object.entries(DECOR_GLB_SRC)) {
      const onDisk = existsSync(join(publicDir, src.replace(/^\//, "")));
      expect(DECOR_GLB_AVAILABLE.has(id as never)).toBe(onDisk);
    }
  });

  it("keeps every shipped prop small enough to load on the stage", () => {
    for (const asset of DECOR_ASSETS) {
      const file = join(publicDir, DECOR_GLB_SRC[asset.id].replace(/^\//, ""));
      expect(statSync(file).size).toBeLessThan(MAX_DECOR_GLB_BYTES);
    }
  });

  it("ships the Draco decoder the GLB loaders point at", () => {
    const stageSource = readFileSync(join(__dirname, "stage-glb-prop.tsx"), "utf8");
    expect(stageSource).toMatch(/setDecoderPath\("\/draco\/gltf\/"\)/);
    for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
      expect(existsSync(join(publicDir, "draco/gltf", file))).toBe(true);
    }
  });

  it("falls back to pending CSS when a GLB is missing and filters stage props", () => {
    expect(iconsSource).toMatch(/decorGlbAvailable/);
    expect(iconsSource).toMatch(/studio-ws__asset-icon--pending/);
    expect(iconsSource).toMatch(/ModeGlbThumb/);
    expect(posterSource).toMatch(/decorGlbAvailable\(item\.id\)/);
    expect(posterSource).toMatch(/StageGlbProp/);
    expect(posterSource).not.toMatch(/DECOR_ASSET_SRC/);
  });
});
