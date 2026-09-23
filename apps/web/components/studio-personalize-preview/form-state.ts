/**
 * Local-only Studio personalize state. No persistence, no network writes.
 */

import {
  ANIMATIONS,
  CAMERA_PRESETS,
  DECOR_ASSETS,
  STAGES,
  STYLE_PRESETS,
  TRANSFORM_MODES,
  type AnimationId,
  type CameraPresetId,
  type DecorId,
  type StudioStageId,
  type StylePresetId,
  type TransformModeId
} from "./fixtures";

export type PersonalizeState = {
  stage: StudioStageId;
  completedStages: StudioStageId[];
  transformMode: TransformModeId;
  volume: number;
  details: number;
  preserveOutline: boolean;
  stylePreset: StylePresetId;
  originalColors: boolean;
  light: number;
  shadow: number;
  animation: AnimationId;
  decor: DecorId[];
  cameraPreset: CameraPresetId;
  gridOn: boolean;
  zoom: number;
  orbitYaw: number;
  orbitPitch: number;
  /** Rotation on the drawing plane (roll), degrees. */
  orbitRoll: number;
  /** Flat dimmed page behind pop-out. Default off — never extruded. */
  showOriginalPage: boolean;
  autoRotate: boolean;
  variantIndex: number;
  arLive: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  /** Local publish-prep dialog. Never a real publish. */
  publishOpen: boolean;
};

const STYLE_CYCLE: StylePresetId[] = ["preserve", "clay", "painted"];

/** Default upright 3/4 for Pop-out. */
export const DEFAULT_ORBIT_YAW = -32;
export const DEFAULT_ORBIT_PITCH = 8;
export const DEFAULT_ZOOM = 100;
export const ORBIT_YAW_STEP = 15;
export const ORBIT_PITCH_STEP = 10;
export const ORBIT_ROLL_STEP = 15;
/** "Sus" looks down from above. Arrow pitch is not limited to this angle. */
export const ORBIT_PITCH_MAX = 48;
/** Almost side-on so extrusion edges read clearly. */
export const LATERAL_ORBIT_YAW = -86;
export const LATERAL_ORBIT_PITCH = 6;

export function wrapYaw(yaw: number): number {
  const turns = ((yaw + 180) % 360 + 360) % 360;
  return turns - 180;
}

/** Same direction as `target`, chosen so a CSS turn does not spin the long way. */
function nearestAngle(current: number, target: number): number {
  const cycles = Math.round((current - target) / 360);
  return target + cycles * 360;
}

export function createInitialPersonalizeState(): PersonalizeState {
  return {
    stage: "personajul",
    completedStages: ["desenul"],
    transformMode: "popout",
    volume: 62,
    details: 48,
    preserveOutline: true,
    stylePreset: "preserve",
    originalColors: true,
    light: 58,
    shadow: 36,
    animation: "still",
    decor: [],
    cameraPreset: "threequarter",
    gridOn: true,
    zoom: 100,
    orbitYaw: DEFAULT_ORBIT_YAW,
    orbitPitch: DEFAULT_ORBIT_PITCH,
    orbitRoll: 0,
    showOriginalPage: false,
    autoRotate: false,
    variantIndex: 0,
    arLive: false,
    leftOpen: false,
    rightOpen: false,
    publishOpen: false
  };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function withCompleted(state: PersonalizeState, stage: StudioStageId): StudioStageId[] {
  if (state.completedStages.includes(stage)) return state.completedStages;
  return [...state.completedStages, stage];
}

export function setStage(state: PersonalizeState, stage: StudioStageId): PersonalizeState {
  return {
    ...state,
    stage,
    completedStages: withCompleted(state, state.stage),
    arLive: stage === "testeaza" ? state.arLive : false,
    leftOpen: false,
    rightOpen: true
  };
}

export function setPublishOpen(state: PersonalizeState, publishOpen: boolean): PersonalizeState {
  return { ...state, publishOpen };
}

export function setArLive(state: PersonalizeState, arLive: boolean): PersonalizeState {
  if (!arLive) return { ...state, arLive: false };
  return {
    ...state,
    arLive: true,
    stage: "testeaza",
    completedStages: withCompleted(state, state.stage),
    leftOpen: false,
    rightOpen: true
  };
}

export function setTransformMode(
  state: PersonalizeState,
  transformMode: TransformModeId
): PersonalizeState {
  return { ...state, transformMode };
}

export function setVolume(state: PersonalizeState, volume: number): PersonalizeState {
  return { ...state, volume: clamp(volume) };
}

export function setDetails(state: PersonalizeState, details: number): PersonalizeState {
  return { ...state, details: clamp(details) };
}

export function setPreserveOutline(
  state: PersonalizeState,
  preserveOutline: boolean
): PersonalizeState {
  return { ...state, preserveOutline };
}

export function setStylePreset(
  state: PersonalizeState,
  stylePreset: StylePresetId
): PersonalizeState {
  return { ...state, stylePreset };
}

export function setOriginalColors(
  state: PersonalizeState,
  originalColors: boolean
): PersonalizeState {
  return { ...state, originalColors };
}

export function setLight(state: PersonalizeState, light: number): PersonalizeState {
  return { ...state, light: clamp(light) };
}

export function setShadow(state: PersonalizeState, shadow: number): PersonalizeState {
  return { ...state, shadow: clamp(shadow) };
}

export function setAnimation(state: PersonalizeState, animation: AnimationId): PersonalizeState {
  return { ...state, animation };
}

export function toggleDecor(state: PersonalizeState, decorId: DecorId): PersonalizeState {
  const has = state.decor.includes(decorId);
  return {
    ...state,
    decor: has ? state.decor.filter((id) => id !== decorId) : [...state.decor, decorId]
  };
}

export function setCameraPreset(
  state: PersonalizeState,
  cameraPreset: CameraPresetId
): PersonalizeState {
  if (cameraPreset === "reset") {
    return {
      ...state,
      cameraPreset: "threequarter",
      zoom: DEFAULT_ZOOM,
      orbitYaw: DEFAULT_ORBIT_YAW,
      orbitPitch: nearestAngle(state.orbitPitch, DEFAULT_ORBIT_PITCH),
      orbitRoll: nearestAngle(state.orbitRoll, 0),
      autoRotate: false
    };
  }
  if (cameraPreset === "front") {
    return {
      ...state,
      cameraPreset,
      orbitYaw: 0,
      orbitPitch: nearestAngle(state.orbitPitch, 0),
      orbitRoll: nearestAngle(state.orbitRoll, 0),
      autoRotate: false
    };
  }
  if (cameraPreset === "threequarter") {
    return {
      ...state,
      cameraPreset,
      orbitYaw: DEFAULT_ORBIT_YAW,
      orbitPitch: nearestAngle(state.orbitPitch, DEFAULT_ORBIT_PITCH),
      orbitRoll: nearestAngle(state.orbitRoll, 0),
      autoRotate: false
    };
  }
  if (cameraPreset === "side") {
    return {
      ...state,
      cameraPreset,
      orbitYaw: LATERAL_ORBIT_YAW,
      orbitPitch: nearestAngle(state.orbitPitch, LATERAL_ORBIT_PITCH),
      orbitRoll: nearestAngle(state.orbitRoll, 0),
      autoRotate: false
    };
  }
  if (cameraPreset === "top") {
    return {
      ...state,
      cameraPreset,
      orbitYaw: 0,
      orbitPitch: nearestAngle(state.orbitPitch, ORBIT_PITCH_MAX),
      orbitRoll: nearestAngle(state.orbitRoll, 0),
      autoRotate: false
    };
  }
  return { ...state, cameraPreset, autoRotate: false };
}

export function nudgeOrbit(
  state: PersonalizeState,
  deltaYaw: number,
  deltaPitch: number,
  fromUser = false,
  deltaRoll = 0
): PersonalizeState {
  return {
    ...state,
    cameraPreset: "threequarter",
    autoRotate: fromUser ? false : state.autoRotate,
    orbitYaw: wrapYaw(state.orbitYaw + deltaYaw),
    orbitPitch: state.orbitPitch + deltaPitch,
    orbitRoll: state.orbitRoll + deltaRoll
  };
}

type Quat = { x: number; y: number; z: number; w: number };

function quatMul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  };
}

function quatNormalize(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

function quatFromAxisAngle(ax: number, ay: number, az: number, angleRad: number): Quat {
  const h = angleRad * 0.5;
  const s = Math.sin(h);
  const len = Math.hypot(ax, ay, az) || 1;
  return { x: (ax / len) * s, y: (ay / len) * s, z: (az / len) * s, w: Math.cos(h) };
}

/** Match CSS `rotateY(yaw) rotateX(pitch) rotateZ(roll)` → R = Ry * Rx * Rz. */
export function orbitEulerToQuat(yawDeg: number, pitchDeg: number, rollDeg: number): Quat {
  const qy = quatFromAxisAngle(0, 1, 0, (yawDeg * Math.PI) / 180);
  const qx = quatFromAxisAngle(1, 0, 0, (pitchDeg * Math.PI) / 180);
  const qz = quatFromAxisAngle(0, 0, 1, (rollDeg * Math.PI) / 180);
  return quatNormalize(quatMul(qy, quatMul(qx, qz)));
}

/** Inverse of {@link orbitEulerToQuat}, unwrapped toward `prior` so CSS turns stay short. */
export function orbitQuatToEuler(
  q: Quat,
  prior: { yaw: number; pitch: number; roll: number }
): { yaw: number; pitch: number; roll: number } {
  const n = quatNormalize(q);
  const { x, y, z, w } = n;
  // R = Ry * Rx * Rz  (same extraction as ZXY extrinsic / matching our product)
  const sinP = 2 * (w * x - y * z);
  const pitch = (Math.asin(Math.min(1, Math.max(-1, sinP))) * 180) / Math.PI;
  const yaw =
    (Math.atan2(2 * (w * y + z * x), 1 - 2 * (x * x + y * y)) * 180) / Math.PI;
  const roll =
    (Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)) * 180) / Math.PI;
  return {
    yaw: nearestAngle(prior.yaw, yaw),
    pitch: nearestAngle(prior.pitch, pitch),
    roll: nearestAngle(prior.roll, roll)
  };
}

/**
 * Apply arrow/drag intent in the photo's local frame so controls follow
 * the drawing after any yaw / pitch / roll mix (not the initial placement).
 * screenX: +right · screenY: +up · screenRoll: +CW on the photo plane
 */
export function nudgeOrbitFromScreen(
  state: PersonalizeState,
  screenX: number,
  screenY: number,
  screenRoll = 0,
  fromUser = true
): PersonalizeState {
  const current = orbitEulerToQuat(state.orbitYaw, state.orbitPitch, state.orbitRoll);
  let delta = { x: 0, y: 0, z: 0, w: 1 };
  if (screenX !== 0) {
    delta = quatMul(delta, quatFromAxisAngle(0, 1, 0, (screenX * Math.PI) / 180));
  }
  if (screenY !== 0) {
    delta = quatMul(delta, quatFromAxisAngle(1, 0, 0, (screenY * Math.PI) / 180));
  }
  if (screenRoll !== 0) {
    delta = quatMul(delta, quatFromAxisAngle(0, 0, 1, (screenRoll * Math.PI) / 180));
  }
  // Local (photo) frame: q' = q * Δ — axes move with the drawing.
  const next = orbitQuatToEuler(quatMul(current, delta), {
    yaw: state.orbitYaw,
    pitch: state.orbitPitch,
    roll: state.orbitRoll
  });
  return {
    ...state,
    cameraPreset: "threequarter",
    autoRotate: fromUser ? false : state.autoRotate,
    orbitYaw: next.yaw,
    orbitPitch: next.pitch,
    orbitRoll: next.roll
  };
}

export function setShowOriginalPage(state: PersonalizeState, showOriginalPage: boolean): PersonalizeState {
  return { ...state, showOriginalPage };
}

export function setAutoRotate(state: PersonalizeState, autoRotate: boolean): PersonalizeState {
  return { ...state, autoRotate };
}

export function setVariantIndex(state: PersonalizeState, index: number): PersonalizeState {
  const next = ((index % STYLE_CYCLE.length) + STYLE_CYCLE.length) % STYLE_CYCLE.length;
  const stylePreset = STYLE_CYCLE[next] ?? "preserve";
  return {
    ...state,
    variantIndex: next,
    stylePreset,
    originalColors: stylePreset === "preserve",
    volume: clamp(55 + next * 12),
    details: clamp(40 + next * 18),
    light: clamp(50 + next * 10),
    shadow: clamp(30 + next * 8)
  };
}

export function regenerateVariant(state: PersonalizeState): PersonalizeState {
  return setVariantIndex(state, state.variantIndex + 1);
}

export function toggleGrid(state: PersonalizeState): PersonalizeState {
  return { ...state, gridOn: !state.gridOn };
}

export function frameFit(state: PersonalizeState): PersonalizeState {
  return {
    ...state,
    zoom: 100,
    cameraPreset: "front",
    orbitYaw: 0,
    orbitPitch: 0,
    orbitRoll: 0,
    autoRotate: false
  };
}

export function setZoom(state: PersonalizeState, zoom: number): PersonalizeState {
  return { ...state, zoom: clamp(zoom, 60, 160) };
}

export function setLeftOpen(state: PersonalizeState, leftOpen: boolean): PersonalizeState {
  return { ...state, leftOpen, rightOpen: leftOpen ? false : state.rightOpen };
}

export function setRightOpen(state: PersonalizeState, rightOpen: boolean): PersonalizeState {
  return { ...state, rightOpen, leftOpen: rightOpen ? false : state.leftOpen };
}

function labelOf<T extends string>(options: { id: T; label: string }[], id: T): string {
  return options.find((item) => item.id === id)?.label ?? id;
}

/** Compact summary for live region. */
export function summarizePersonalize(state: PersonalizeState): string {
  const parts = [
    labelOf(STAGES, state.stage),
    labelOf(TRANSFORM_MODES, state.transformMode),
    labelOf(STYLE_PRESETS, state.stylePreset),
    labelOf(ANIMATIONS, state.animation),
    `variantă ${state.variantIndex + 1}`
  ];
  if (state.decor.length > 0) {
    parts.push(state.decor.map((id) => labelOf(DECOR_ASSETS, id)).join(", "));
  }
  return parts.join(" · ");
}

export function isStageComplete(state: PersonalizeState, stage: StudioStageId): boolean {
  return state.completedStages.includes(stage) || state.stage === stage;
}

/**
 * Paths that must never be called as write endpoints from this preview shell.
 * The one exception is PATCH /api/projects/:projectId for settings.scene.startTransform.
 */
export function isStartTransformPatchPath(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";
  return /^\/api\/projects\/[^/]+$/.test(path);
}

export function isPersonalizeWriteBlocked(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";
  if (isStartTransformPatchPath(path)) return false;
  if (path.startsWith("/api/")) return true;
  return false;
}

export const FORBIDDEN_PERSISTENCE_APIS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches"
] as const;

export const FORBIDDEN_COPY_SNIPPETS = ["publicat", "upload"] as const;
