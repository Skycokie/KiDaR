/**
 * Studio personalize preview — fixture-only workspace.
 * No ProjectRecord, projectId, sourceUrl, or private assets.
 * Copy lives in `messages.personalize` / `messages.studio`; this file holds IDs.
 */

export const PERSONALIZE_BACK_HREF = "/studio";
export const PERSONALIZE_CAMERA_HREF = "/studio-preview/personalizeaza/camera";
export const PERSONALIZE_STUDIO_HREF = "/studio-preview/personalizeaza";

export const FIXTURE_WORLD = {
  id: "garden-after-rain"
} as const;

export type StudioStageId =
  | "desenul"
  | "personajul"
  | "aspect"
  | "miscare"
  | "decor"
  | "context"
  | "vocea"
  | "testeaza";

export type TransformModeId = "popout" | "figurine";
export type StylePresetId = "preserve" | "clay" | "painted";
export type AnimationId = "wave" | "float" | "dance" | "jump" | "still";
export type DecorId = "cloud" | "stars" | "grass" | "tree" | "house" | "planet" | "balloons";
export type CameraPresetId = "front" | "threequarter" | "side" | "top" | "reset";
export type PaletteId = "original" | "bright" | "soft";
export type LightingId = "warm" | "studio";

export type ChoiceOption<T extends string> = {
  id: T;
};

export const STAGE_MESSAGE_KEY = {
  desenul: "drawing",
  personajul: "character",
  aspect: "appearance",
  miscare: "motion",
  decor: "decor",
  context: "context",
  vocea: "voice",
  testeaza: "ar"
} as const satisfies Record<StudioStageId, "drawing" | "character" | "appearance" | "motion" | "decor" | "context" | "voice" | "ar">;

/** Narrative path — IDs for the left rail. Labels live in messages.studio.steps. */
export const STAGES: ChoiceOption<StudioStageId>[] = [
  { id: "desenul" },
  { id: "personajul" },
  { id: "aspect" },
  { id: "miscare" },
  { id: "decor" },
  { id: "context" },
  { id: "vocea" },
  { id: "testeaza" }
];

export const TRANSFORM_MODES: ChoiceOption<TransformModeId>[] = [
  { id: "popout" },
  { id: "figurine" }
];

export const STYLE_PRESETS: ChoiceOption<StylePresetId>[] = [
  { id: "preserve" },
  { id: "clay" },
  { id: "painted" }
];

export const ANIMATIONS: ChoiceOption<AnimationId>[] = [
  { id: "wave" },
  { id: "float" },
  { id: "dance" },
  { id: "jump" },
  { id: "still" }
];

export const DECOR_ASSETS: ChoiceOption<DecorId>[] = [
  { id: "cloud" },
  { id: "stars" },
  { id: "grass" },
  { id: "tree" },
  { id: "house" },
  { id: "planet" },
  { id: "balloons" }
];

export const PALETTES: ChoiceOption<PaletteId>[] = [
  { id: "original" },
  { id: "bright" },
  { id: "soft" }
];

export const LIGHTINGS: ChoiceOption<LightingId>[] = [
  { id: "warm" },
  { id: "studio" }
];

export const CAMERA_PRESETS: ChoiceOption<CameraPresetId>[] = [
  { id: "front" },
  { id: "threequarter" },
  { id: "side" },
  { id: "top" },
  { id: "reset" }
];
