import { describe, expect, it } from "vitest";
import {
  activatePopout,
  createPopoutInteractionState,
  markPopoutFailed,
  markPopoutReady,
  popoutDisplayPhase,
  settlePopout
} from "./popout-interaction";

describe("homepage pop-out interaction", () => {
  it("keeps PNG until activation and does not mount GLB by default", () => {
    const state = createPopoutInteractionState();
    expect(state.phase).toBe("png");
    expect(state.mountGlb).toBe(false);
    expect(state.reveal).toBe("in");
    expect(popoutDisplayPhase(state)).toBe("png");
  });

  it("ignores activation under reduced motion", () => {
    const state = activatePopout(createPopoutInteractionState(), { reducedMotion: true });
    expect(state).toEqual(createPopoutInteractionState());
  });

  it("loads on first activation, then plays once ready and returns to PNG", () => {
    let state = activatePopout(createPopoutInteractionState(), { reducedMotion: false });
    expect(state.phase).toBe("loading");
    expect(state.mountGlb).toBe(true);
    expect(state.reveal).toBe("in");
    expect(popoutDisplayPhase(state)).toBe("png");

    state = activatePopout(state, { reducedMotion: false });
    expect(state.phase).toBe("loading");

    state = markPopoutReady(state);
    expect(state.phase).toBe("playing");
    expect(state.reveal).toBe("out");
    expect(state.spinId).toBe(1);
    expect(popoutDisplayPhase(state)).toBe("ready");

    state = settlePopout(state);
    expect(state.phase).toBe("ready");
    expect(state.reveal).toBe("in");
    expect(state.mountGlb).toBe(true);
    expect(popoutDisplayPhase(state)).toBe("ready");
  });

  it("replays from a cached ready model without remounting", () => {
    let state = markPopoutReady(
      activatePopout(createPopoutInteractionState(), { reducedMotion: false })
    );
    state = settlePopout(state);
    state = activatePopout(state, { reducedMotion: false });
    expect(state.phase).toBe("playing");
    expect(state.spinId).toBe(2);
    expect(state.mountGlb).toBe(true);
  });

  it("falls back to PNG permanently after a load failure", () => {
    let state = activatePopout(createPopoutInteractionState(), { reducedMotion: false });
    state = markPopoutFailed(state);
    expect(state.phase).toBe("failed");
    expect(state.mountGlb).toBe(false);
    expect(popoutDisplayPhase(state)).toBe("failed");
    expect(activatePopout(state, { reducedMotion: false })).toEqual(state);
  });
});
