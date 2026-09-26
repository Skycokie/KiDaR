import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyContextStory, applyIdeaPrompt, createInitialPersonalizeState, setDecorSelection, setLighting, setPalette } from "./form-state";
import {
  CURRENT_SCENE_ELIGIBILITY,
  evaluateFutureSceneEligibility,
  sceneSummary,
  toStudioSceneDraft
} from "./scene-draft";

const openGate = {
  technicalStatus: "ready" as const,
  sceneAssetAvailable: true,
  qualityReview: "approved" as const,
  arFormatAvailable: true,
  arFlag: "true",
  authenticated: true,
  owner: true
};

describe("local Studio scene draft", () => {
  it("assembles the current choices into one preview-only scene", () => {
    let state = createInitialPersonalizeState();
    state = { ...state, animation: "float", volume: 80, details: 40, preserveOutline: false };
    state = setDecorSelection(state, "stars");
    state = setPalette(state, "bright");
    state = setLighting(state, "studio");
    state = { ...state, ideaPrompt: "printre stele" };
    const draft = toStudioSceneDraft(state, true);
    expect(draft).toMatchObject({
      sourceImageId: "session-source",
      characterMode: "popout",
      volume: 80,
      detail: 40,
      preserveOutline: false,
      palette: "bright",
      lighting: "studio",
      motion: "float",
      decor: "stars",
      prompt: "printre stele",
      context: {
        location: "",
        action: "",
        mood: "",
        dialogue: "",
        story: "",
        previewOnly: true
      },
      previewOnly: true
    });
    expect(sceneSummary(draft).map((line) => `${line.label}: ${line.value}`)).toEqual([
      "Personaj: Pop-out din desen",
      "Mișcare: Plutește",
      "Decor: Stele",
      "Lumină: Lumină de studio",
      "Sursă: Desenul tău"
    ]);
  });

  it("carries an applied story into the same preview-only scene", () => {
    const next = applyContextStory(
      createInitialPersonalizeState(),
      "Personajul meu plutește printre stele, salută și spune «Bună!»."
    );
    const draft = toStudioSceneDraft(next, true);
    expect(draft.context).toMatchObject({
      location: "printre stele",
      action: "salută",
      dialogue: "Bună!",
      previewOnly: true
    });
    expect(draft.motion).toBe("wave");
    expect(draft.decor).toBe("stars");
    expect(draft.previewOnly).toBe(true);
    expect(CURRENT_SCENE_ELIGIBILITY.arEligible).toBe(false);
  });

  it("lets a Romanian idea update the same scene without a network call", () => {
    const next = applyIdeaPrompt(createInitialPersonalizeState(), "Să plutească printre stele");
    const draft = toStudioSceneDraft(next, true);
    expect(draft.motion).toBe("float");
    expect(draft.decor).toBe("stars");
    expect(draft.previewOnly).toBe(true);
    expect(CURRENT_SCENE_ELIGIBILITY.arEligible).toBe(false);
  });

  it("keeps future AR closed unless every separate gate is true", () => {
    expect(CURRENT_SCENE_ELIGIBILITY).toEqual({
      technicalStatus: "pending",
      sceneAssetAvailable: false,
      qualityReview: "pending",
      arFormatAvailable: false,
      arEligible: false
    });
    expect(evaluateFutureSceneEligibility(openGate).arEligible).toBe(true);
    expect(evaluateFutureSceneEligibility({ ...openGate, arFlag: "TRUE" }).arEligible).toBe(false);
    expect(evaluateFutureSceneEligibility({ ...openGate, qualityReview: "pending" }).arEligible).toBe(false);
    expect(evaluateFutureSceneEligibility({ ...openGate, owner: false }).arEligible).toBe(false);
    expect(evaluateFutureSceneEligibility({ ...openGate, sceneAssetAvailable: false }).arEligible).toBe(false);
    const source = readFileSync(join(__dirname, "scene-draft.ts"), "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(|getUserMedia|WebXR|rel="ar"/);
  });
});
