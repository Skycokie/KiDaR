import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COPY,
  FIXTURE_WORLD,
  PERSONALIZE_BACK_HREF,
  PERSONALIZE_CAMERA_HREF,
  PERSONALIZE_STUDIO_HREF,
  STAGES
} from "./fixtures";
import {
  createInitialPersonalizeState,
  DEFAULT_ORBIT_PITCH,
  DEFAULT_ORBIT_YAW,
  FORBIDDEN_COPY_SNIPPETS,
  isPersonalizeWriteBlocked,
  LATERAL_ORBIT_PITCH,
  LATERAL_ORBIT_YAW,
  nudgeOrbit,
  nudgeOrbitFromScreen,
  orbitDeltaFromPointer,
  ORBIT_DRAG_DEG_PER_PX,
  ORBIT_PITCH_MAX,
  ORBIT_PITCH_STEP,
  ORBIT_ROLL_STEP,
  ORBIT_YAW_STEP,
  setAnimation,
  setAutoRotate,
  setCameraPreset,
  setShowOriginalPage,
  setPublishOpen,
  setStage,
  setStylePreset,
  setTransformMode,
  setVolume,
  setArLive,
  summarizePersonalize,
  toggleDecor,
  toggleGrid,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomFromPinch,
  zoomFromWheel
} from "./form-state";

const root = join(__dirname);

function readLocal(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

describe("Studio personalize workspace — fixture + local state", () => {
  it("exposes only the documented fixture world (no projectId / sourceUrl)", () => {
    expect(FIXTURE_WORLD.title).toBe("Grădina de după ploaie");
    expect(FIXTURE_WORLD.status).toBe("Previzualizare");
    expect(FIXTURE_WORLD.mode).toBe("Popout");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("projectId");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("sourceUrl");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("owner");
  });

  it("exposes the narrative Studio path labels", () => {
    expect(STAGES.map((stage) => stage.label)).toEqual([
      "Desen",
      "Personaj",
      "Aspect",
      "Mișcare",
      "Decor",
      "AR"
    ]);
  });

  it("starts on Personaj with Desen already completed", () => {
    const state = createInitialPersonalizeState();
    expect(state.stage).toBe("personajul");
    expect(state.completedStages).toContain("desenul");
    expect(state.transformMode).toBe("popout");
    expect(state.cameraPreset).toBe("threequarter");
    expect(state.orbitYaw).toBe(-32);
    expect(state.gridOn).toBe(true);
    expect(summarizePersonalize(state)).toContain("Personaj");
  });

  it("updates stage, transform, style, animation, decor, and camera in memory only", () => {
    let state = createInitialPersonalizeState();
    state = setStage(state, "aspect");
    state = setTransformMode(state, "figurine");
    state = setStylePreset(state, "clay");
    state = setAnimation(state, "wave");
    state = toggleDecor(state, "stars");
    state = setCameraPreset(state, "top");
    state = setVolume(state, 80);
    state = toggleGrid(state);
    expect(state).toMatchObject({
      stage: "aspect",
      transformMode: "figurine",
      stylePreset: "clay",
      animation: "wave",
      cameraPreset: "top",
      volume: 80,
      gridOn: false
    });
    expect(state.decor).toEqual(["stars"]);
    expect(state.completedStages).toContain("personajul");
    expect(summarizePersonalize(state)).toContain("Lut colorat");
  });

  it("camera reset restores default 3/4 composition and stops auto-rotate", () => {
    let state = setAutoRotate(createInitialPersonalizeState(), true);
    state = { ...state, zoom: 140, cameraPreset: "top", orbitYaw: 20, orbitPitch: 30 };
    state = setCameraPreset(state, "reset");
    expect(state.cameraPreset).toBe("threequarter");
    expect(state.zoom).toBe(100);
    expect(state.orbitYaw).toBe(DEFAULT_ORBIT_YAW);
    expect(state.orbitPitch).toBe(DEFAULT_ORBIT_PITCH);
    expect(state.autoRotate).toBe(false);
  });

  it("hides the original page by default and keeps the reference toggle local", () => {
    const state = createInitialPersonalizeState();
    expect(state.showOriginalPage).toBe(false);
    const shown = setShowOriginalPage(state, true);
    expect(shown.showOriginalPage).toBe(true);
    expect(createInitialPersonalizeState().showOriginalPage).toBe(false);
    expect(state.showOriginalPage).toBe(false);
  });

  it("steps yaw and pitch through a full turn", () => {
    let state = createInitialPersonalizeState();
    state = nudgeOrbit(state, -ORBIT_YAW_STEP, 0, true);
    expect(state.orbitYaw).toBe(DEFAULT_ORBIT_YAW - ORBIT_YAW_STEP);
    state = nudgeOrbit(state, ORBIT_YAW_STEP, ORBIT_PITCH_STEP, true);
    expect(state.orbitYaw).toBe(DEFAULT_ORBIT_YAW);
    expect(state.orbitPitch).toBe(DEFAULT_ORBIT_PITCH + ORBIT_PITCH_STEP);
    state = nudgeOrbit({ ...state, orbitPitch: ORBIT_PITCH_MAX }, 0, ORBIT_PITCH_STEP);
    expect(state.orbitPitch).toBe(ORBIT_PITCH_MAX + ORBIT_PITCH_STEP);
    state = nudgeOrbit({ ...state, orbitPitch: 350 }, 0, ORBIT_PITCH_STEP);
    expect(state.orbitPitch).toBe(360);
    state = nudgeOrbit({ ...state, orbitPitch: -350 }, 0, -ORBIT_PITCH_STEP);
    expect(state.orbitPitch).toBe(-360);
    let spun = createInitialPersonalizeState();
    for (let step = 0; step < 360 / ORBIT_PITCH_STEP; step += 1) {
      spun = nudgeOrbit(spun, 0, ORBIT_PITCH_STEP);
    }
    expect(spun.orbitPitch).toBe(DEFAULT_ORBIT_PITCH + 360);
    const reset = setCameraPreset(spun, "reset");
    expect(reset.orbitPitch).toBe(DEFAULT_ORBIT_PITCH + 360);
  });

  it("steps planar roll and resets it with the camera preset", () => {
    let state = createInitialPersonalizeState();
    expect(state.orbitRoll).toBe(0);
    state = nudgeOrbit(state, 0, 0, true, ORBIT_ROLL_STEP);
    expect(state.orbitRoll).toBe(ORBIT_ROLL_STEP);
    expect(state.autoRotate).toBe(false);
    state = nudgeOrbit(state, 0, 0, true, -ORBIT_ROLL_STEP * 2);
    expect(state.orbitRoll).toBe(-ORBIT_ROLL_STEP);
    const reset = setCameraPreset(state, "reset");
    expect(reset.orbitRoll).toBe(0);
  });

  it("keeps arrow axes on the photo after planar roll", () => {
    let state = createInitialPersonalizeState();
    state = { ...state, orbitRoll: 90, orbitYaw: 0, orbitPitch: 0 };
    // Local left after 90° roll becomes a pitch change — not stuck on initial yaw.
    const left = nudgeOrbitFromScreen(state, -ORBIT_YAW_STEP, 0, 0, true);
    expect(Math.abs(left.orbitYaw)).toBeLessThan(0.001);
    expect(left.orbitPitch).toBeCloseTo(ORBIT_YAW_STEP, 5);
    expect(left.orbitRoll).toBeCloseTo(90, 5);
    // Local up after roll becomes yaw.
    const up = nudgeOrbitFromScreen(state, 0, ORBIT_PITCH_STEP, 0, true);
    expect(up.orbitYaw).toBeCloseTo(ORBIT_PITCH_STEP, 5);
    expect(Math.abs(up.orbitPitch)).toBeLessThan(0.001);
    // Unrolled: arrows still map to yaw / pitch directly.
    const flat = nudgeOrbitFromScreen(
      { ...state, orbitRoll: 0 },
      -ORBIT_YAW_STEP,
      ORBIT_PITCH_STEP,
      0,
      true
    );
    expect(flat.orbitYaw).toBeCloseTo(-ORBIT_YAW_STEP, 5);
    expect(flat.orbitPitch).toBeCloseTo(ORBIT_PITCH_STEP, 5);
    // Roll stays on the photo plane after a prior yaw/pitch pose.
    const rolled = nudgeOrbitFromScreen(
      { ...createInitialPersonalizeState(), orbitYaw: -32, orbitPitch: 8, orbitRoll: 0 },
      0,
      0,
      ORBIT_ROLL_STEP,
      true
    );
    expect(rolled.orbitYaw).toBeCloseTo(-32, 5);
    expect(rolled.orbitPitch).toBeCloseTo(8, 5);
    expect(rolled.orbitRoll).toBeCloseTo(ORBIT_ROLL_STEP, 5);
  });

  it("auto-rotate starts off and reset returns the upright 3/4 view", () => {
    const fresh = createInitialPersonalizeState();
    expect(fresh.autoRotate).toBe(false);
    const spinning = setAutoRotate(fresh, true);
    expect(spinning.autoRotate).toBe(true);
    const side = setCameraPreset(spinning, "side");
    expect(side.orbitYaw).toBe(LATERAL_ORBIT_YAW);
    expect(side.orbitPitch).toBe(LATERAL_ORBIT_PITCH);
    expect(side.autoRotate).toBe(false);
    const reset = setCameraPreset(setAutoRotate(side, true), "reset");
    expect(reset.autoRotate).toBe(false);
    expect(reset.cameraPreset).toBe("threequarter");
    expect(reset.orbitYaw).toBe(DEFAULT_ORBIT_YAW);
    expect(reset.orbitPitch).toBe(DEFAULT_ORBIT_PITCH);
    expect(reset.zoom).toBe(100);
  });

  it("transform mode toggles locally between popout and figurine", () => {
    let state = createInitialPersonalizeState();
    expect(state.transformMode).toBe("popout");
    state = setTransformMode(state, "figurine");
    expect(state.transformMode).toBe("figurine");
    expect(summarizePersonalize(state)).toContain("Figurină 3D");
    state = setTransformMode(state, "popout");
    expect(state.transformMode).toBe("popout");
    expect(summarizePersonalize(state)).toContain("Pop-out din desen");
  });

  it("transform mode has no persistence helpers", () => {
    let state = createInitialPersonalizeState();
    state = setTransformMode(state, "figurine");
    const again = createInitialPersonalizeState();
    expect(again.transformMode).toBe("popout");
    expect(state.transformMode).toBe("figurine");
    expect(isPersonalizeWriteBlocked("/api/projects/x")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/source")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/publish")).toBe(true);
  });

  it("setArLive opens the AR stage with a local overlay flag", () => {
    let state = createInitialPersonalizeState();
    state = setArLive(state, true);
    expect(state.stage).toBe("testeaza");
    expect(state.arLive).toBe(true);
    state = setStage(state, "aspect");
    expect(state.arLive).toBe(false);
    expect(state.publishOpen).toBe(false);
    const open = setPublishOpen(state, true);
    expect(open.publishOpen).toBe(true);
    expect(setPublishOpen(open, false).publishOpen).toBe(false);
  });

  it("blocks api writes except the owned project start-transform path", () => {
    expect(isPersonalizeWriteBlocked("/api/projects")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/projects/x")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/asset")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/publish")).toBe(true);
    expect(PERSONALIZE_BACK_HREF).toBe("/studio-preview");
    expect(PERSONALIZE_STUDIO_HREF).toBe("/studio-preview/personalizeaza");
    expect(PERSONALIZE_CAMERA_HREF).toBe("/studio-preview/personalizeaza/camera");
  });

  it("shell sources have no fetch, storage, camera hardware, or write verbs", () => {
    const shell = readLocal("personalize-shell.tsx");
    const poster = readLocal("garden-poster.tsx");
    const fixtures = readLocal("fixtures.ts");
    const impl = `${shell}\n${poster}`;

    expect(impl).not.toMatch(/\bfetch\s*\(/);
    expect(impl).not.toMatch(/XMLHttpRequest|WebSocket/);
    expect(impl).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
    expect(impl).not.toMatch(/\bnavigator\.mediaDevices\b|\.getUserMedia\b/);
    expect(impl).not.toMatch(/\bFormData\b|\bFileReader\b/);
    expect(impl).not.toMatch(/ProjectRecord|StudioWorldCard/);
    expect(shell).not.toMatch(/\bfetch\s*\(/);
    for (const snippet of FORBIDDEN_COPY_SNIPPETS) {
      expect(impl.includes(snippet)).toBe(false);
      expect(fixtures.includes(snippet)).toBe(false);
    }
    expect(fixtures).toContain(COPY.title);
    expect(fixtures).toContain(COPY.savedLocal);
    expect(fixtures).toContain(COPY.publish);
    expect(fixtures).toContain(COPY.seeInAr);
    expect(fixtures).toContain(COPY.regenerate);
    expect(shell).toContain("PERSONALIZE_STUDIO_HREF");
    expect(shell).toContain("studio-ws__dpad");
    expect(shell).toContain("studio-ws__roll");
    expect(shell).toContain("studio-ws__spin");
    expect(shell).toContain('aria-label={COPY.tiltUp}');
    expect(shell).toContain('aria-label={COPY.tiltDown}');
    expect(shell).toContain('aria-label={COPY.rotateLeft}');
    expect(shell).toContain('aria-label={COPY.rotateRight}');
    expect(shell).toContain('aria-label={COPY.rollCcw}');
    expect(shell).toContain('aria-label={COPY.rollCw}');
    expect(shell).toContain('aria-label={COPY.resetView}');
    expect(shell).toContain("nudgeOrbitFromScreen");
    expect(shell).toContain("yaw: -ORBIT_YAW_STEP");
    expect(shell).toContain("yaw: ORBIT_YAW_STEP");
    expect(shell).toContain("pitch: ORBIT_PITCH_STEP");
    expect(shell).toContain("pitch: -ORBIT_PITCH_STEP");
    expect(shell).toContain("roll: -ORBIT_ROLL_STEP");
    expect(shell).toContain("roll: ORBIT_ROLL_STEP");
    expect(shell).toContain('dispatch({ type: "camera", id: "reset" })');
    expect(shell).toContain('dispatch({ type: "autoRotate", value: !state.autoRotate })');
    expect(shell).not.toContain("useState");
    expect(fixtures).toContain(COPY.autoRotateOff);
    expect(fixtures).toContain(COPY.autoRotateStop);
    expect(fixtures).toContain(COPY.rollCcw);
    expect(fixtures).toContain(COPY.rollCw);
    expect(shell).toContain("setArLive");
    expect(shell).toContain('dispatch({ type: "publish", open: true })');
    expect(shell).toContain("disabled={!projectId}");
    expect(shell).toContain("studio-ws__publish-scrim");
    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain("closePublish");
    expect(shell).toContain("{COPY.publishWorld}");
    expect(shell).toContain("disabled");
    expect(shell).not.toContain("href={`/studio/${projectId}`}");
    expect(shell).not.toContain('from "next/link"');
    expect(fixtures).toContain(COPY.publishPrepareTitle);
    expect(fixtures).toContain(COPY.publishInactive);
    expect(fixtures).toContain(COPY.publishQrLabel);
    expect(shell).toContain("transformMode={state.transformMode}");
    expect(shell).toMatch(/studio-ws__ghost-btn[^>]*\bdisabled\b/);
    expect(poster).toContain("transformMode");
    expect(poster).toContain("data-mode={transformMode}");
    expect(poster).toContain("PopoutMeshStage");
    expect(poster).toContain("ssr: false");
    expect(poster).not.toContain("PopoutDrawingStack");
    expect(poster).toContain("PopoutFixtureFigure");
    expect(poster).toContain("FigurineFixtureFigure");
    expect(poster).toContain("FigurineDrawingShell");
    expect(poster).toContain("figurineVolumeScale");
    expect(poster).toContain("popoutExtrusionPx");
    const removedHint = "Rotește lumea pentru a vedea straturile.";
    expect(fixtures).not.toContain(removedHint);
    expect(poster).not.toContain(removedHint);
    expect(shell).not.toContain(removedHint);
    expect(readLocal("personalize-preview.css")).not.toContain(removedHint);
    expect(fixtures).toContain("Pregătim Pop-out-ul…");
    expect(fixtures).toContain(COPY.figurineVolumeHint);
  });

  it("maps pointer drag and wheel or pinch onto the same orbit and zoom", () => {
    const start = { ...createInitialPersonalizeState(), autoRotate: true };
    const delta = orbitDeltaFromPointer(40, -20);
    expect(delta.yaw).toBeCloseTo(40 * ORBIT_DRAG_DEG_PER_PX);
    expect(delta.pitch).toBeCloseTo(20 * ORBIT_DRAG_DEG_PER_PX);
    const dragged = nudgeOrbitFromScreen(start, delta.yaw, delta.pitch, 0, true);
    expect(dragged.autoRotate).toBe(false);
    expect(dragged.orbitYaw).not.toBe(start.orbitYaw);
    expect(dragged.orbitPitch).not.toBe(start.orbitPitch);
    const spinning = nudgeOrbitFromScreen(start, 4, 0, 0, false);
    expect(spinning.autoRotate).toBe(true);

    expect(zoomFromWheel(100, 12)).toBe(95);
    expect(zoomFromWheel(ZOOM_MIN, 12)).toBe(ZOOM_MIN);
    expect(zoomFromWheel(ZOOM_MAX, -12)).toBe(ZOOM_MAX);
    expect(zoomFromPinch(100, 100, 110)).toBe(110);
    expect(zoomFromPinch(100, 100, 400)).toBe(ZOOM_MAX);
    expect(zoomFromPinch(100, 200, 40)).toBe(ZOOM_MIN);
  });

  it("keeps direct manipulation on the shared orbit path and parks mobile controls in Reglaje", () => {
    const shell = readLocal("personalize-shell.tsx");
    const css = readLocal("personalize-preview.css");
    const stage = readLocal("popout-mesh-stage.tsx");
    expect(shell).toContain("orbitDeltaFromPointer(dx, dy)");
    expect(shell).toContain("yaw: delta.yaw, pitch: delta.pitch, user: true");
    expect(shell).toContain('dispatch({ type: "autoRotate", value: false })');
    expect(shell).toContain("zoomFromWheel");
    expect(shell).toContain("zoomFromPinch");
    expect(shell).toContain("event.preventDefault()");
    expect(shell).not.toContain("onPointerLeave");
    expect(shell).toContain("studio-ws__view-controls--sheet");
    expect(shell).toContain("studio-ws__spin--float");
    expect(shell).toContain("studio-ws__overlay-tools");
    expect(shell).toContain('dispatch({ type: "orbit", yaw: 0, pitch: ORBIT_PITCH_STEP, user: true })');
    expect(css).toContain("touch-action: none");
    expect(css).toMatch(/@media \(max-width: 959px\)[\s\S]*\.studio-ws__overlay-tools\s*\{\s*display:\s*none/);
    expect(css).toMatch(/@media \(max-width: 959px\)[\s\S]*\.studio-ws__view-controls--sheet\s*\{\s*display:\s*grid/);
    expect(css).toMatch(/@media \(min-width: 960px\)[\s\S]*\.studio-ws__view-controls--sheet\s*\{\s*display:\s*none/);
    expect(stage).toContain("}, [sourceUrl, retryToken]);");
    expect(stage).toContain("}, [phase, sourceUrl, retryToken]);");
    expect(stage).toContain("sessionExtracts");
    expect(stage).not.toContain("}, [sourceUrl, retryToken, yaw");
    expect(stage).not.toContain("}, [sourceUrl, retryToken, zoom");
    const extractEffect = stage.slice(stage.indexOf("const cached = retryToken"), stage.indexOf("}, [sourceUrl, retryToken]);"));
    expect(extractEffect).toContain("createPreviewCutout");
    expect(extractEffect).not.toContain("viewRef");
  });

  it("Vezi în AR stays local-only and does not navigate to a camera route", () => {
    const shell = readLocal("personalize-shell.tsx");
    expect(shell).not.toContain("/studio-preview/personalizeaza/camera");
    expect(shell).not.toContain("PERSONALIZE_CAMERA_HREF");
    expect(shell).toContain("arLive");
    expect(shell).toContain("setArLive");
  });
});
