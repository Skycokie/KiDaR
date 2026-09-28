/**
 * Local scene assembled from the current Studio session.
 * previewOnly is always true. Nothing here is an AR asset or an Appwrite field.
 *
 * A future AR launch is a separate decision from generation, quality review,
 * and publish. It may start only when every gate below is true together:
 * technicalStatus === "ready", a scene asset exists, an AR format exists,
 * qualityReview === "approved", the AR feature flag is exactly "true",
 * the user is authenticated, and they own the project.
 * iOS/iPadOS would then open USDZ with Apple Quick Look.
 * Android would use GLB or the approved viewer only after support detection
 * and an explicit click. Unsupported devices keep this local preview.
 * The current session never requests a camera and never claims AR is available.
 */

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import type {
  AnimationId,
  DecorId,
  LightingId,
  PaletteId,
  TransformModeId
} from "./fixtures";
import type { PersonalizeState } from "./form-state";
import type { SceneContext } from "./scene-context";
import { emptySceneContext } from "./scene-context";

export type StudioSceneDraft = {
  sourceImageId: string | null;
  characterMode: "popout" | "figure3d-preview";
  volume: number;
  detail: number;
  preserveOutline: boolean;
  palette: PaletteId;
  lighting: LightingId;
  motion: AnimationId;
  decor: "none" | DecorId;
  prompt: string;
  context: SceneContext;
  previewOnly: true;
};

export type FutureSceneEligibility = {
  technicalStatus: "pending" | "ready" | "failed";
  sceneAssetAvailable: boolean;
  qualityReview: "pending" | "approved" | "rejected";
  arFormatAvailable: boolean;
  arEligible: boolean;
};

export type FutureArGate = {
  technicalStatus: FutureSceneEligibility["technicalStatus"];
  sceneAssetAvailable: boolean;
  qualityReview: FutureSceneEligibility["qualityReview"];
  arFormatAvailable: boolean;
  arFlag: string | undefined;
  authenticated: boolean;
  owner: boolean;
};

/** Closed for this session. Not a stored product field. */
export const CURRENT_SCENE_ELIGIBILITY: FutureSceneEligibility = {
  technicalStatus: "pending",
  sceneAssetAvailable: false,
  qualityReview: "pending",
  arFormatAvailable: false,
  arEligible: false
};

export function toStudioSceneDraft(state: PersonalizeState, hasSource: boolean): StudioSceneDraft {
  const decor = state.decor[0]?.id;
  const context = state.context ?? emptySceneContext();
  return {
    sourceImageId: hasSource ? "session-source" : null,
    characterMode: characterModeFromTransform(state.transformMode),
    volume: state.volume,
    detail: state.details,
    preserveOutline: state.preserveOutline,
    palette: state.palette,
    lighting: state.lighting,
    motion: state.animation,
    decor: decor ?? "none",
    prompt: state.ideaPrompt,
    context: {
      location: typeof context.location === "string" ? context.location : "",
      action: typeof context.action === "string" ? context.action : "",
      mood: typeof context.mood === "string" ? context.mood : "",
      dialogue: typeof context.dialogue === "string" ? context.dialogue : "",
      story: typeof context.story === "string" ? context.story : "",
      previewOnly: true
    },
    previewOnly: true
  };
}

export type SceneSummaryLine = { label: string; value: string };

export function sceneSummary(draft: StudioSceneDraft, locale: Locale = "ro"): SceneSummaryLine[] {
  const messages = getMessages(locale);
  const COPY = messages.personalize;
  const character = draft.characterMode === "figure3d-preview" ? "figurine" : "popout";
  return [
    { label: messages.studio.steps.character, value: COPY.choices.modes[character].label },
    { label: messages.studio.steps.motion, value: COPY.choices.animations[draft.motion].label },
    {
      label: messages.studio.steps.decor,
      value: draft.decor === "none" ? COPY.noDecor : COPY.choices.decor[draft.decor].label
    },
    { label: COPY.lightingSection, value: COPY.choices.lightings[draft.lighting].label },
    { label: COPY.sourceLabel, value: draft.sourceImageId ? COPY.yourDrawing : COPY.demoPreview }
  ];
}

/** Documents the future conjunction. The live UI does not call this to enable AR. */
export function evaluateFutureSceneEligibility(gate: FutureArGate): FutureSceneEligibility {
  const arEligible =
    gate.technicalStatus === "ready" &&
    gate.sceneAssetAvailable === true &&
    gate.arFormatAvailable === true &&
    gate.qualityReview === "approved" &&
    gate.arFlag === "true" &&
    gate.authenticated === true &&
    gate.owner === true;
  return {
    technicalStatus: gate.technicalStatus,
    sceneAssetAvailable: gate.sceneAssetAvailable,
    qualityReview: gate.qualityReview,
    arFormatAvailable: gate.arFormatAvailable,
    arEligible
  };
}

export function characterModeFromTransform(mode: TransformModeId): StudioSceneDraft["characterMode"] {
  return mode === "figurine" ? "figure3d-preview" : "popout";
}
