/**
 * Interaction-only homepage GLB pop-out.
 * PNG is the default. Hover/click loads the model once, plays one turn, then returns to PNG.
 */

export type PopoutPhase = "png" | "loading" | "ready" | "playing" | "failed";

export type PopoutInteractionState = {
  phase: PopoutPhase;
  reveal: "in" | "out";
  spinId: number;
  /** Mount the GLB viewer only after the first activation (no preload). */
  mountGlb: boolean;
};

export function createPopoutInteractionState(): PopoutInteractionState {
  return {
    phase: "png",
    reveal: "in",
    spinId: 0,
    mountGlb: false
  };
}

/** Display phase for CharacterPopout styling: hide sticker only while revealing. */
export function popoutDisplayPhase(
  state: PopoutInteractionState
): "png" | "ready" | "failed" {
  if (state.phase === "failed") return "failed";
  if (state.phase === "ready" || state.phase === "playing") return "ready";
  return "png";
}

export function activatePopout(
  state: PopoutInteractionState,
  options: { reducedMotion: boolean; force?: boolean }
): PopoutInteractionState {
  if (options.reducedMotion) return state;
  if (state.phase === "failed" || state.phase === "loading") {
    return state;
  }
  if (state.phase === "playing") {
    if (!options.force) return state;
    return {
      ...state,
      reveal: "out",
      spinId: state.spinId + 1
    };
  }
  if (state.phase === "ready") {
    return {
      ...state,
      phase: "playing",
      reveal: "out",
      spinId: state.spinId + 1
    };
  }
  return {
    ...state,
    phase: "loading",
    mountGlb: true,
    reveal: "in"
  };
}

export function markPopoutReady(state: PopoutInteractionState): PopoutInteractionState {
  if (state.phase !== "loading") return state;
  return {
    ...state,
    phase: "playing",
    reveal: "out",
    spinId: state.spinId + 1
  };
}

export function markPopoutFailed(state: PopoutInteractionState): PopoutInteractionState {
  return {
    ...state,
    phase: "failed",
    reveal: "in",
    mountGlb: false
  };
}

export function settlePopout(state: PopoutInteractionState): PopoutInteractionState {
  if (state.phase !== "playing") return state;
  return {
    ...state,
    phase: "ready",
    reveal: "in"
  };
}
