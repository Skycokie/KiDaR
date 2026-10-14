import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n/get-messages";
import {
  ANIMATIONS,
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
  orbitEulerToQuat,
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
  setVariantIndex,
  setVolume,
  setArLive,
  removeDecorInstance,
  moveDecorInstance,
  orbitDecorInstance,
  setDecorSelection,
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
    const world = getMessages("ro").personalize.fixtureWorld;
    expect(world.title).toBe("Grădina de după ploaie");
    expect(world.status).toBe("Previzualizare");
    expect(world.mode).toBe("Popout");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("projectId");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("sourceUrl");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("owner");
  });

  it("exposes the narrative Studio path labels", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      "desenul",
      "personajul",
      "decor",
      "vocea",
      "testeaza"
    ]);
    expect(getMessages("ro").studio.steps).toEqual({
      drawing: "Desen",
      character: "Personaj",
      motion: "Mișcare",
      decor: "Decor",
      context: "Context",
      voice: "Vocea",
      ar: "AR"
    });
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
    state = setStage(state, "decor");
    state = setTransformMode(state, "figurine");
    state = setStylePreset(state, "clay");
    state = setAnimation(state, "wave");
    state = toggleDecor(state, "grass");
    state = setCameraPreset(state, "top");
    state = setVolume(state, 80);
    state = toggleGrid(state);
    expect(state).toMatchObject({
      stage: "decor",
      transformMode: "figurine",
      stylePreset: "clay",
      animation: "wave",
      cameraPreset: "top",
      volume: 80,
      gridOn: false
    });
    expect(state.decor.map((item) => item.id)).toEqual(["grass"]);
    expect(state.decor[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(state.completedStages).toContain("personajul");
    expect(summarizePersonalize(state)).toContain("Lut colorat");
  });

  it("sets follow animation to AR camera-follow anchor mode", () => {
    const start = createInitialPersonalizeState();
    expect(start.arAnchorMode).toBe("marker");
    const follow = setAnimation(start, "follow");
    expect(follow).toMatchObject({ animation: "follow", arAnchorMode: "follow" });
    expect(setAnimation(follow, "wave")).toMatchObject({
      animation: "wave",
      arAnchorMode: "marker"
    });
    expect(ANIMATIONS.some((item) => item.id === "follow")).toBe(true);
    expect(getMessages("ro").personalize.choices.animations.follow.label).toBe("Cu tine");
  });

  it("makes Variante switch style and palette so color reads clearly", () => {
    const start = createInitialPersonalizeState();
    const preserve = setVariantIndex(start, 0);
    const clay = setVariantIndex(start, 1);
    const painted = setVariantIndex(start, 2);
    expect(preserve).toMatchObject({
      stylePreset: "preserve",
      palette: "original",
      originalColors: true,
      variantIndex: 0
    });
    expect(clay).toMatchObject({
      stylePreset: "clay",
      palette: "soft",
      originalColors: false,
      variantIndex: 1
    });
    expect(painted).toMatchObject({
      stylePreset: "painted",
      palette: "bright",
      originalColors: false,
      variantIndex: 2
    });
    expect(painted.details).toBeGreaterThan(clay.details);
    expect(clay.details).toBeGreaterThan(preserve.details);
    const css = readFileSync(join(root, "personalize-preview.css"), "utf8");
    expect(css).toMatch(/\.studio-stage--clay \.studio-stage__popout-live/);
    expect(css).toMatch(/\.studio-stage--painted \.studio-stage__popout-live/);
    expect(css).not.toMatch(/\.studio-stage\[data-colors="styled"\] \.studio-stage__drawing-img/);
  });

  it("stacks decor on each card click, moves on stage, and removes by key", () => {
    let state = setDecorSelection(createInitialPersonalizeState(), "stars");
    expect(state.decor.map((item) => item.id)).toEqual(["stars"]);
    state = setDecorSelection(state, "stars");
    expect(state.decor.map((item) => item.id)).toEqual(["stars", "stars"]);
    state = setDecorSelection(state, "grass");
    expect(state.decor.map((item) => item.id)).toEqual(["stars", "stars", "grass"]);
    const key = state.decor[0]!.key;
    state = moveDecorInstance(state, key, 40, 55);
    expect(state.decor[0]).toMatchObject({ key, x: 40, y: 55 });
    state = removeDecorInstance(state, key);
    expect(state.decor.map((item) => item.id)).toEqual(["stars", "grass"]);
    state = orbitDecorInstance(state, state.decor[0]!.key, 0.4, -0.1);
    expect(state.decor[0]).toMatchObject({ yaw: 0.4, pitch: -0.1 });
    state = setDecorSelection(state, "none");
    expect(state.decor).toEqual([]);
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

  it("drag follows the finger in screen space for any pose, including upside down", () => {
    type V = { x: number; y: number; z: number };
    type Q = { x: number; y: number; z: number; w: number };
    const rotate = (q: Q, v: V): V => {
      // v' = q * v * q^-1 (unit quaternion)
      const t = {
        x: 2 * (q.y * v.z - q.z * v.y),
        y: 2 * (q.z * v.x - q.x * v.z),
        z: 2 * (q.x * v.y - q.y * v.x)
      };
      return {
        x: v.x + q.w * t.x + (q.y * t.z - q.z * t.y),
        y: v.y + q.w * t.y + (q.z * t.x - q.x * t.z),
        z: v.z + q.w * t.z + (q.x * t.y - q.y * t.x)
      };
    };
    const conj = (q: Q): Q => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
    const poses = [
      { orbitYaw: 0, orbitPitch: 0, orbitRoll: 0 },
      { orbitYaw: 180, orbitPitch: 0, orbitRoll: 0 },
      { orbitYaw: 90, orbitPitch: 30, orbitRoll: 0 },
      { orbitYaw: 0, orbitPitch: 120, orbitRoll: 0 },
      { orbitYaw: 0, orbitPitch: 0, orbitRoll: 180 },
      { orbitYaw: -134, orbitPitch: -8, orbitRoll: 180 }
    ];
    // Where the model surface facing the viewer / the model's right edge ends up on screen.
    const front: V = { x: 0, y: 0, z: 1 };
    const right: V = { x: 1, y: 0, z: 0 };
    const moved = (pose: (typeof poses)[number], sx: number, sy: number, sr: number, point: V) => {
      const base = { ...createInitialPersonalizeState(), ...pose };
      const next = nudgeOrbitFromScreen(base, sx, sy, sr, true);
      const q0 = orbitEulerToQuat(base.orbitYaw, base.orbitPitch, base.orbitRoll);
      const q1 = orbitEulerToQuat(next.orbitYaw, next.orbitPitch, next.orbitRoll);
      const model = rotate(conj(q0), point);
      const before = rotate(q0, model);
      const after = rotate(q1, model);
      return { dx: after.x - before.x, dy: after.y - before.y };
    };
    for (const pose of poses) {
      expect(moved(pose, 10, 0, 0, front).dx).toBeGreaterThan(0.05); // drag right -> moves right
      expect(moved(pose, -10, 0, 0, front).dx).toBeLessThan(-0.05); // drag left -> moves left
      expect(moved(pose, 0, 10, 0, front).dy).toBeGreaterThan(0.05); // drag up -> moves up
      expect(moved(pose, 0, -10, 0, front).dy).toBeLessThan(-0.05); // drag down -> moves down
      expect(moved(pose, 0, 0, 10, right).dy).toBeLessThan(-0.05); // clockwise -> right edge goes down
    }
  });

  it("uses the Three / AR convention at rest: right = +yaw, up = -pitch", () => {
    const state = createInitialPersonalizeState();
    const base = { ...state, orbitYaw: 0, orbitPitch: 0, orbitRoll: 0 };
    expect(nudgeOrbitFromScreen(base, ORBIT_YAW_STEP, 0, 0, true).orbitYaw).toBeCloseTo(ORBIT_YAW_STEP, 5);
    expect(nudgeOrbitFromScreen(base, 0, ORBIT_PITCH_STEP, 0, true).orbitPitch).toBeCloseTo(-ORBIT_PITCH_STEP, 5);
    expect(nudgeOrbitFromScreen(base, 0, -ORBIT_PITCH_STEP, 0, true).orbitPitch).toBeCloseTo(ORBIT_PITCH_STEP, 5);
    expect(nudgeOrbitFromScreen(base, 0, 0, ORBIT_ROLL_STEP, true).orbitRoll).toBeCloseTo(-ORBIT_ROLL_STEP, 5);
  });

  it("stays well defined with the model pointing straight up", () => {
    const base = { ...createInitialPersonalizeState(), orbitYaw: 30, orbitPitch: -90, orbitRoll: 0 };
    const next = nudgeOrbitFromScreen(base, 4, 0, 0, true);
    for (const value of [next.orbitYaw, next.orbitPitch, next.orbitRoll]) {
      expect(Number.isFinite(value)).toBe(true);
    }
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
    expect(isPersonalizeWriteBlocked("/api/projects/x/figurine")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/voices/primary")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/voices/primary/audio")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/publish")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/publish")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/qr?download=1")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/publish/extra")).toBe(true);
  });

  it("setArLive opens the AR stage with a local overlay flag", () => {
    let state = createInitialPersonalizeState();
    state = setArLive(state, true);
    expect(state.stage).toBe("testeaza");
    expect(state.arLive).toBe(true);
    state = setStage(state, "decor");
    expect(state.arLive).toBe(false);
    expect(state.publishOpen).toBe(false);
    const open = setPublishOpen(state, true);
    expect(open.publishOpen).toBe(true);
    expect(setPublishOpen(open, false).publishOpen).toBe(false);
  });

  it("blocks api writes except the owned project start-transform path", () => {
    expect(isPersonalizeWriteBlocked("/api/projects")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/projects/x")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/figurine")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/voices/primary")).toBe(false);
    expect(isPersonalizeWriteBlocked("/api/projects/x/asset")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/checkout")).toBe(true);
    expect(PERSONALIZE_BACK_HREF).toBe("/studio");
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
    const COPY = getMessages("ro").personalize;
    expect(COPY.title).toBe("Lumea mea");
    expect(COPY.savedLocal).toBe("Salvat în această sesiune");
    expect(COPY.publish).toBe("Publică");
    expect(COPY.seeInAr).toBe("Vezi în AR");
    expect(COPY.seeInArPreparing).toBe("AR în pregătire");
    expect(COPY.arCardCaption).toBe("Previzualizare locală");
    expect(shell).toContain("messages.studio.arPreparing");
    expect(shell).toContain("messages.personalize");
    expect(shell).not.toContain("studio-ws__ar-live");
    expect(shell).not.toContain("Previzualizare AR locală");
    expect(COPY.regenerate).toContain("previzualizare");
    expect(shell).toContain("PERSONALIZE_BACK_HREF");
    expect(shell).toContain("studio-ws__spin");
    expect(shell).not.toContain("studio-ws__dpad");
    expect(shell).not.toContain("studio-ws__roll");
    expect(shell).toContain("nudgeOrbitFromScreen");
    expect(shell).toContain("orbitDeltaFromPointer(dx, dy)");
    expect(shell).toContain('dispatch({ type: "camera", id: preset.id })');
    expect(shell).toContain('dispatch({ type: "autoRotate", value: !state.autoRotate })');
    expect(shell).toContain("useState");
    expect(shell).toContain("readCharacterVoiceStatus");
    expect(shell).toContain("spokenMessage");
    expect(shell).toContain("VoiceCard");
    expect(COPY.autoRotateOff).toBe("360°");
    expect(COPY.autoRotateStop).toContain("360");
    expect(COPY.rollCcw).toMatch(/plan/);
    expect(COPY.rollCw).toMatch(/plan/);
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
    expect(COPY.publishPrepareTitle).toMatch(/publicare/);
    expect(COPY.publishInactive).toMatch(/activată/);
    expect(COPY.publishQrLabel).toMatch(/QR/);
    expect(shell).toContain("transformMode={state.transformMode}");
    expect(shell).toContain('dispatch({ type: "variant", index: -1 })');
    expect(shell).toContain("studio-ws__variant");
    expect(shell).toContain("STYLE_PRESETS.map");
    expect(shell).toContain("studio-ws__variant-photo");
    expect(shell).toContain("COPY.choices.styles[preset.id]");
    expect(shell).not.toMatch(/studio-ws__ghost-btn[^>]*\bdisabled\b/);
    expect(poster).toContain("transformMode");
    expect(poster).toContain("data-mode={transformMode}");
    expect(poster).toContain("PopoutMeshStage");
    expect(poster).toContain("FigurineLiveStage");
    expect(poster).toContain("ssr: false");
    expect(poster).not.toContain("PopoutDrawingStack");
    expect(poster).toContain("PopoutFixtureFigure");
    expect(poster).toContain("FigurineFixtureFigure");
    expect(poster).toContain("FigurineDrawingShell");
    expect(shell).toContain("FigurineGenerateCard");
    expect(shell).toContain("ImportModelCard");
    expect(poster).toContain("FigurineGlbStage");
    expect(poster).toContain("figurineVolumeScale");
    expect(poster).toContain("popoutExtrusionPx");
    const removedHint = "Rotește lumea pentru a vedea straturile.";
    expect(fixtures).not.toContain(removedHint);
    expect(poster).not.toContain(removedHint);
    expect(shell).not.toContain(removedHint);
    expect(readLocal("personalize-preview.css")).not.toContain(removedHint);
    expect(COPY.popoutPreparing).toMatch(/Pop-out/);
    expect(COPY.figurineVolumeHint).toMatch(/Tripo/);
    expect(fixtures).not.toMatch(/[ăâîșşțţ]/i);
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
    expect(shell).not.toContain("studio-ws__dpad");
    expect(css).toContain("touch-action: none");
    expect(css).toMatch(/@media \(max-width: 899px\)[\s\S]*\.studio-ws__overlay-tools\s*\{\s*display:\s*none/);
    expect(css).toMatch(/@media \(max-width: 899px\)[\s\S]*\.studio-ws__view-controls--sheet\s*\{\s*display:\s*grid/);
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*\.studio-ws__view-controls--sheet\s*\{\s*display:\s*none/);
    expect(stage).toContain("}, [sourceUrl, retryToken]);");
    expect(stage).toContain("}, [phase, sourceUrl, retryToken]);");
    expect(stage).toContain("sessionExtracts");
    expect(stage).not.toContain("}, [sourceUrl, retryToken, yaw");
    expect(stage).not.toContain("}, [sourceUrl, retryToken, zoom");
    const extractEffect = stage.slice(stage.indexOf("const cached = retryToken"), stage.indexOf("}, [sourceUrl, retryToken]);"));
    expect(extractEffect).toContain("createPreviewCutout");
    expect(extractEffect).not.toContain("viewRef");
  });

  it("Vezi în AR is disabled until real assets exist and does not open a fake AR overlay", () => {
    const shell = readLocal("personalize-shell.tsx");
    expect(shell).not.toContain("/studio-preview/personalizeaza/camera");
    expect(shell).not.toContain("PERSONALIZE_CAMERA_HREF");
    expect(shell).toContain("messages.studio.arPreparing");
    expect(getMessages("ro").personalize.seeInArPreparing).toBe("AR în pregătire");
    expect(getMessages("ro").personalize.seeSceneInAr).toBe("Vezi scena în AR");
    expect(getMessages("ro").personalize.sceneHeading).toBe("Vezi scena în lumea ta");
    expect(getMessages("ro").personalize.sceneLocalLabel).toBe(
      "Previzualizare locală — scena nu este încă disponibilă în AR."
    );
    expect(shell).toContain("data-ar-eligible=");
    expect(shell).toContain("mirror");
    expect(shell).not.toMatch(/\brel=["']ar["']/);
    expect(shell).not.toMatch(/\bnavigator\.mediaDevices\b|\.getUserMedia\b/);
    expect(shell).not.toContain("studio-ws__ar-live");
    expect(shell).not.toContain("onClick={openAr}");
  });
});
