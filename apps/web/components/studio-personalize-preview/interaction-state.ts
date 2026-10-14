/**
 * Optional local play mode for the Studio preview.
 * Transforms stay here and never enter the creative draft, a generation job, or AR.
 * Real AR placement is a later, separate decision and is not started from this state.
 */

export const INTERACTION_YAW_LIMIT = 22;
export const INTERACTION_PITCH_LIMIT = 10;
export const INTERACTION_ZOOM_MIN = 0.8;
export const INTERACTION_ZOOM_MAX = 1.4;

const YAW_PER_PX = 0.15;
const PITCH_PER_PX = 0.06;
const WHEEL_ZOOM_STEP = 0.06;
const BUTTON_ZOOM_STEP = 0.1;
const NUDGE_PX = 36;

export type InteractionTarget = "none" | "character" | "decor";

export type InteractionState = {
  enabled: boolean;
  rotationY: number;
  rotationX: number;
  zoom: number;
  activeTarget: InteractionTarget;
  reactionNonce: number;
};

export type InteractionAction =
  | { type: "enable"; enabled: boolean }
  | { type: "drag"; dx: number; dy: number }
  | { type: "wheel"; deltaY: number }
  | { type: "zoom"; direction: -1 | 1 }
  | { type: "nudge"; direction: -1 | 1 }
  | { type: "character" }
  | { type: "decor" }
  | { type: "reset" };

export function createInteractionState(): InteractionState {
  return {
    enabled: false,
    rotationY: 0,
    rotationX: 0,
    zoom: 1,
    activeTarget: "none",
    reactionNonce: 0
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampInteractionZoom(zoom: number): number {
  return clamp(zoom, INTERACTION_ZOOM_MIN, INTERACTION_ZOOM_MAX);
}

export function setInteractionEnabled(state: InteractionState, enabled: boolean): InteractionState {
  if (!enabled) return { ...resetInteractionView(state), enabled: false };
  return { ...state, enabled: true };
}

export function applyInteractionDrag(state: InteractionState, dx: number, dy: number): InteractionState {
  if (!state.enabled) return state;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return state;
  return {
    ...state,
    rotationY: clamp(state.rotationY + dx * YAW_PER_PX, -INTERACTION_YAW_LIMIT, INTERACTION_YAW_LIMIT),
    rotationX: clamp(state.rotationX - dy * PITCH_PER_PX, -INTERACTION_PITCH_LIMIT, INTERACTION_PITCH_LIMIT)
  };
}

export function applyInteractionWheel(state: InteractionState, deltaY: number): InteractionState {
  if (!state.enabled || !Number.isFinite(deltaY) || deltaY === 0) return state;
  return {
    ...state,
    zoom: clampInteractionZoom(state.zoom + (deltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP))
  };
}

export function nudgeInteractionZoom(state: InteractionState, direction: -1 | 1): InteractionState {
  if (!state.enabled) return state;
  return { ...state, zoom: clampInteractionZoom(state.zoom + direction * BUTTON_ZOOM_STEP) };
}

export function nudgeInteractionRotation(state: InteractionState, direction: -1 | 1): InteractionState {
  return applyInteractionDrag(state, direction * NUDGE_PX, 0);
}

export function reactToCharacter(state: InteractionState): InteractionState {
  if (!state.enabled) return state;
  return { ...state, activeTarget: "character", reactionNonce: state.reactionNonce + 1 };
}

export function highlightDecor(state: InteractionState): InteractionState {
  if (!state.enabled) return state;
  return { ...state, activeTarget: "decor" };
}

/** Clears play transforms only. Creative selections are not part of this object. */
export function resetInteractionView(state: InteractionState): InteractionState {
  return {
    ...state,
    rotationY: 0,
    rotationX: 0,
    zoom: 1,
    activeTarget: "none",
    reactionNonce: 0
  };
}

export function reduceInteraction(state: InteractionState, action: InteractionAction): InteractionState {
  switch (action.type) {
    case "enable":
      return setInteractionEnabled(state, action.enabled);
    case "drag":
      return applyInteractionDrag(state, action.dx, action.dy);
    case "wheel":
      return applyInteractionWheel(state, action.deltaY);
    case "zoom":
      return nudgeInteractionZoom(state, action.direction);
    case "nudge":
      return nudgeInteractionRotation(state, action.direction);
    case "character":
      return reactToCharacter(state);
    case "decor":
      return highlightDecor(state);
    case "reset":
      return resetInteractionView(state);
    default:
      return state;
  }
}
