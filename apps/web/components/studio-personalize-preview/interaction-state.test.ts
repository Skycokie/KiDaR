import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialPersonalizeState, setAnimation, setDecorSelection, setPalette } from "./form-state";
import {
  INTERACTION_YAW_LIMIT,
  INTERACTION_ZOOM_MAX,
  INTERACTION_ZOOM_MIN,
  applyInteractionDrag,
  applyInteractionWheel,
  createInteractionState,
  highlightDecor,
  nudgeInteractionZoom,
  reactToCharacter,
  reduceInteraction,
  resetInteractionView,
  setInteractionEnabled
} from "./interaction-state";

describe("local Studio interactions", () => {
  it("toggles only the local play mode", () => {
    const draft = setPalette(setDecorSelection(setAnimation(createInitialPersonalizeState(), "dance"), "tree"), "bright");
    const enabled = setInteractionEnabled(createInteractionState(), true);
    expect(enabled.enabled).toBe(true);
    expect(draft.animation).toBe("dance");
    expect(draft.decor.map((item) => item.id)).toEqual(["tree"]);
    expect(draft.palette).toBe("bright");
    expect(setInteractionEnabled(enabled, false).enabled).toBe(false);
  });

  it("clamps drag rotation and wheel zoom", () => {
    const enabled = setInteractionEnabled(createInteractionState(), true);
    const dragged = applyInteractionDrag(enabled, 10_000, -10_000);
    expect(dragged.rotationY).toBe(INTERACTION_YAW_LIMIT);
    expect(dragged.rotationX).toBeLessThanOrEqual(10);
    expect(dragged.rotationX).toBeGreaterThan(0);
    let zoomed = enabled;
    for (let step = 0; step < 40; step += 1) zoomed = applyInteractionWheel(zoomed, -1);
    expect(zoomed.zoom).toBe(INTERACTION_ZOOM_MAX);
    for (let step = 0; step < 40; step += 1) zoomed = applyInteractionWheel(zoomed, 1);
    expect(zoomed.zoom).toBe(INTERACTION_ZOOM_MIN);
    expect(nudgeInteractionZoom(zoomed, -1).zoom).toBe(INTERACTION_ZOOM_MIN);
  });

  it("reacts locally and reset keeps the creative draft", () => {
    const draft = { ...createInitialPersonalizeState(), ideaPrompt: "printre stele" };
    let play = setInteractionEnabled(createInteractionState(), true);
    play = applyInteractionDrag(play, 20, 4);
    play = nudgeInteractionZoom(play, 1);
    play = reactToCharacter(play);
    expect(play.reactionNonce).toBe(1);
    expect(play.activeTarget).toBe("character");
    play = highlightDecor(play);
    expect(play.activeTarget).toBe("decor");
    expect(play.reactionNonce).toBe(1);
    const reset = resetInteractionView(play);
    expect(reset).toMatchObject({
      enabled: true,
      rotationY: 0,
      rotationX: 0,
      zoom: 1,
      activeTarget: "none",
      reactionNonce: 0
    });
    expect(draft.ideaPrompt).toBe("printre stele");
    expect(draft.animation).toBe("still");
  });

  it("ignores play input until the mode is enabled and makes no network call", () => {
    const idle = createInteractionState();
    expect(applyInteractionDrag(idle, 30, 0)).toEqual(idle);
    expect(reactToCharacter(idle)).toEqual(idle);
    expect(reduceInteraction(idle, { type: "zoom", direction: 1 }).zoom).toBe(1);
    const source = [
      readFileSync(join(__dirname, "interaction-state.ts"), "utf8"),
      readFileSync(join(__dirname, "personalize-shell.tsx"), "utf8")
    ].join("\n");
    expect(source).not.toMatch(/\bfetch\s*\(|getUserMedia|webkitGetUserMedia|DeviceOrientation|WebXR|rel=["']ar["']/);
  });
});
