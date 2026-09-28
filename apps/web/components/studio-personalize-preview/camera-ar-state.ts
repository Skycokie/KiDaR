/**
 * Local-only AR camera preview state machine. Button-driven; no timers, no network.
 */

import type { Messages } from "@/i18n/types";
import type { CameraArPhase } from "./camera-ar-fixtures";

export type CameraArState = {
  phase: CameraArPhase;
};

export function createInitialCameraArState(): CameraArState {
  return { phase: "intro" };
}

export function startPreview(state: CameraArState): CameraArState {
  if (state.phase !== "intro") return state;
  return { phase: "preparing" };
}

export function continueFromPreparing(state: CameraArState): CameraArState {
  if (state.phase !== "preparing") return state;
  return { phase: "searching" };
}

export function markFound(state: CameraArState): CameraArState {
  if (state.phase !== "searching" && state.phase !== "lost") return state;
  return { phase: "found" };
}

export function markLost(state: CameraArState): CameraArState {
  if (state.phase !== "found") return state;
  return { phase: "lost" };
}

export function retrySearch(state: CameraArState): CameraArState {
  if (state.phase !== "lost") return state;
  return { phase: "searching" };
}

export function showUnavailable(state: CameraArState): CameraArState {
  return { ...state, phase: "unavailable" };
}

export function showIncompatible(state: CameraArState): CameraArState {
  return { ...state, phase: "incompatible" };
}

export function resetToIntro(): CameraArState {
  return createInitialCameraArState();
}

/** Message announced via aria-live for the current phase. */
export function cameraArStatusMessage(phase: CameraArPhase, copy: Messages["cameraAr"]): string {
  switch (phase) {
    case "intro":
      return copy.introTitle;
    case "preparing":
      return copy.preparing;
    case "searching":
      return copy.searching;
    case "found":
      return copy.found;
    case "lost":
      return copy.lost;
    case "unavailable":
      return copy.unavailable;
    case "incompatible":
      return copy.incompatible;
  }
}

export function showsGuideFrame(phase: CameraArPhase): boolean {
  return phase === "searching" || phase === "found" || phase === "lost";
}

export function showsWorldOverlay(phase: CameraArPhase): boolean {
  return phase === "found" || phase === "lost";
}

export function worldOverlayDimmed(phase: CameraArPhase): boolean {
  return phase === "lost";
}
