import { describe, expect, it } from "vitest";
import {
  applyFotoFixture,
  beginPresetCreate,
  beginSceneSave,
  beginSourceUpload,
  completePresetCreate,
  completeSceneSave,
  completeSourceUpload,
  createInitialCreazaFormState,
  goBack,
  isWritePathBlocked,
  selectExperience,
  selectPreset,
  setLocalSourceSuccess
} from "./form-state";

function makeFile(name: string, type: string, size: number): File {
  const buffer = new Uint8Array(Math.min(size, 64));
  const file = new File([new Blob([buffer], { type })], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("creaza-preview local form state (Create/Source/Scene Go B)", () => {
  it("preserves preset when moving forward and back after create", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "story");
    state = beginPresetCreate(state);
    state = completePresetCreate(state, "proj_story");
    expect(state.step).toBe("foto");
    expect(state.preset).toBe("story");
    expect(state.projectId).toBe("proj_story");
    state = goBack(state);
    expect(state.step).toBe("preset");
    expect(state.preset).toBe("story");
    expect(state.projectId).toBe("proj_story");
  });

  it("shows select error without leaving preset when empty", () => {
    const next = beginPresetCreate(createInitialCreazaFormState());
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

  it("blocks source save without real photo; completes after upload success", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "coloring");
    state = completePresetCreate(beginPresetCreate(state), "proj_foto");
    expect(state.step).toBe("foto");

    state = applyFotoFixture(state, "empty");
    state = beginSourceUpload(state);
    expect(state.step).toBe("foto");
    expect(state.uploadError).toBe("missing-photo");

    state = setLocalSourceSuccess(
      state,
      {
        file: makeFile("live.jpg", "image/jpeg", 40_000),
        objectUrl: "blob:live",
        name: "live.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 40_000
      },
      false
    );
    state = beginSourceUpload(state);
    expect(state.fotoBusy).toBe(true);
    state = completeSourceUpload(state, "/api/files/source/src_1");
    expect(state.step).toBe("experienta");
    expect(state.sourceUrl).toBe("/api/files/source/src_1");
  });

  it("keeps experience choice through confirmation after scene save", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "coloring");
    state = completePresetCreate(beginPresetCreate(state), "proj_done");
    state = setLocalSourceSuccess(
      state,
      {
        file: makeFile("live.jpg", "image/jpeg", 40_000),
        objectUrl: "blob:live",
        name: "live.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 40_000
      },
      false
    );
    state = completeSourceUpload(beginSourceUpload(state), "/api/files/source/src_2");
    state = selectExperience(state, "popout");
    state = completeSceneSave(beginSceneSave(state));
    expect(state.step).toBe("confirmare");
    expect(state.preset).toBe("coloring");
    expect(state.experience).toBe("popout");
    expect(state.sourceUrl).toBeTruthy();
  });

  it("allows create, source, and project PATCH; blocks asset and publish", () => {
    expect(isWritePathBlocked("/api/projects")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/source")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/asset")).toBe(true);
    expect(isWritePathBlocked("/api/auth/magic-link")).toBe(true);
  });
});
