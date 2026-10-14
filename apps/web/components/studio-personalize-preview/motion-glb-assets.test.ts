import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "./fixtures";
import { MOTION_GLB_SRC } from "./motion-glb-assets";
import { DECOR_GLB_SRC } from "./decor-assets";

const posterSource = readFileSync(join(__dirname, "garden-poster.tsx"), "utf8");
const stageSource = readFileSync(join(__dirname, "stage-glb-prop.tsx"), "utf8");
const iconsSource = readFileSync(join(__dirname, "decor-preview-icons.tsx"), "utf8");
const thumbSource = readFileSync(join(__dirname, "mode-glb-thumb.tsx"), "utf8");

describe("Studio motion GLB as decor props", () => {
  it("maps every animation pose to a local motion GLB path used by decor", () => {
    for (const anim of ANIMATIONS) {
      expect(MOTION_GLB_SRC[anim.id]).toBe(`/demo/glb/motion/${anim.id}.glb`);
    }
    expect(DECOR_GLB_SRC.figureWave).toBe(MOTION_GLB_SRC.wave);
    expect(DECOR_GLB_SRC.figureFollow).toBe(MOTION_GLB_SRC.follow);
  });

  it("rotates decor on drag, moves on long-press, removes on idle click", () => {
    expect(posterSource).toMatch(/onDecorMove/);
    expect(posterSource).toMatch(/onDecorOrbit/);
    expect(posterSource).toMatch(/onDecorRemove/);
    expect(posterSource).toMatch(/GLB_ORBIT_DRAG_PX/);
    expect(posterSource).toMatch(/glbOrbitFromPointer/);
    expect(posterSource).toMatch(/mode: \(forceMove \? "move" : "orbit"\)/);
    expect(posterSource).toMatch(/longPressTimer/);
    expect(posterSource).toMatch(/StageGlbProp/);
    expect(iconsSource).toMatch(/interactive=\{false\}/);
    expect(thumbSource).toMatch(/interactive = true/);
    expect(stageSource).toMatch(/root\.position\.y = -minY/);
    expect(stageSource).toMatch(/maxDim \* 2\.55/);
    expect(stageSource).not.toMatch(/autoSpin/);
  });
});
