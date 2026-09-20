import { describe, expect, it } from "vitest";
import {
  applyFotoFixture,
  continueFromExperienta,
  continueFromFoto,
  continueFromPreset,
  createInitialCreazaFormState,
  goBack,
  isWritePathBlocked,
  selectExperience,
  selectPreset
} from "./form-state";

describe("creaza-preview local form state (3.1)", () => {
  it("preserves preset when moving forward and back", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "story");
    state = continueFromPreset(state);
    expect(state.step).toBe("foto");
    expect(state.preset).toBe("story");
    state = goBack(state);
    expect(state.step).toBe("preset");
    expect(state.preset).toBe("story");
  });

  it("shows select error without leaving preset when empty", () => {
    const next = continueFromPreset(createInitialCreazaFormState());
    expect(next.step).toBe("preset");
    expect(next.presetError).toBe("select");
  });

  it("applies source validation to mock descriptors only", () => {
    let state = createInitialCreazaFormState();
    state = applyFotoFixture(state, "error");
    expect(state.fotoError).toBe("type");
    expect(state.fotoUi).toBe("error");

    state = applyFotoFixture(state, "selected");
    expect(state.fotoError).toBe("");
    expect(state.fotoMockName).toBe("desen-atelier.jpg");
  });

  it("blocks foto continue until a valid selection exists", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "coloring");
    state = continueFromPreset(state);
    expect(state.step).toBe("foto");

    state = applyFotoFixture(state, "empty");
    state = continueFromFoto(state);
    expect(state.step).toBe("foto");
    expect(state.fotoError).toBeTruthy();

    state = applyFotoFixture(state, "selected");
    state = continueFromFoto(state);
    expect(state.step).toBe("experienta");
  });

  it("keeps experience choice through confirmation", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "coloring");
    state = continueFromPreset(state);
    state = applyFotoFixture(state, "selected");
    state = continueFromFoto(state);
    state = selectExperience(state, "popout");
    state = continueFromExperienta(state);
    expect(state.step).toBe("confirmare");
    expect(state.preset).toBe("coloring");
    expect(state.experience).toBe("popout");
    expect(state.fotoMockName).toBeTruthy();
  });

  it("flags known write endpoints as blocked", () => {
    expect(isWritePathBlocked("/api/projects")).toBe(true);
    expect(isWritePathBlocked("/api/projects/x/source")).toBe(true);
    expect(isWritePathBlocked("/api/auth/magic-link")).toBe(true);
    expect(isWritePathBlocked("/studio-preview")).toBe(false);
  });
});
