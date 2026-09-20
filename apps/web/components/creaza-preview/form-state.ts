/**
 * Local form state for `/creaza-preview`.
 * Supports fixture UI + real in-memory File preview — never fetches or uploads.
 */

import {
  validateSourceImage,
  type ExperienceChoice,
  type SimpleCreatorPreset
} from "@/lib/simple-creator";
import type { CreazaPreviewStep, FotoFixtureState } from "./fixtures";
import type { LocalSourceImage } from "./local-source";

export type PresetError = "" | "select";
export type FotoValidationError = "" | "type" | "size";

export type MockFileDescriptor = {
  type?: string;
  size: number;
  name?: string;
};

/** Synthetic descriptors for the fixture bar — not real Files. */
export const FOTO_MOCK_FILES: Record<FotoFixtureState, MockFileDescriptor | null> = {
  empty: null,
  "drag-over": null,
  selected: { type: "image/jpeg", size: 180_000, name: "desen-atelier.jpg" },
  error: { type: "application/pdf", size: 12_000, name: "not-an-image.pdf" },
  loading: { type: "image/png", size: 95_000, name: "desen-atelier.png" }
};

export type CreazaLocalFormState = {
  step: CreazaPreviewStep;
  preset: SimpleCreatorPreset | null;
  presetError: PresetError;
  presetBusy: boolean;
  fotoUi: FotoFixtureState;
  fotoError: FotoValidationError;
  fotoSmallWarning: boolean;
  fotoMockName: string | null;
  /** Real browser File held only in page memory (Object URL). */
  localSource: LocalSourceImage | null;
  experience: ExperienceChoice;
};

export const PRESET_ERROR_COPY: Record<Exclude<PresetError, "">, string> = {
  select: "Alege cu ce începe lumea."
};

export const FOTO_ERROR_COPY: Record<Exclude<FotoValidationError, "">, string> = {
  type: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB.",
  size: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB."
};

export function createInitialCreazaFormState(): CreazaLocalFormState {
  return {
    step: "preset",
    preset: null,
    presetError: "",
    presetBusy: false,
    fotoUi: "empty",
    fotoError: "",
    fotoSmallWarning: false,
    fotoMockName: null,
    localSource: null,
    experience: "popout"
  };
}

export function selectPreset(
  state: CreazaLocalFormState,
  preset: SimpleCreatorPreset
): CreazaLocalFormState {
  return { ...state, preset, presetError: "" };
}

/**
 * Fixture bar / drag-over chrome. Clears any real localSource reference
 * (caller must revoke the previous Object URL via effect).
 */
export function applyFotoFixture(
  state: CreazaLocalFormState,
  ui: FotoFixtureState
): CreazaLocalFormState {
  const mock = FOTO_MOCK_FILES[ui];
  if (!mock) {
    return {
      ...state,
      fotoUi: ui,
      fotoError: "",
      fotoSmallWarning: false,
      fotoMockName: null,
      localSource: null
    };
  }
  const result = validateSourceImage(mock);
  return {
    ...state,
    fotoUi: ui,
    fotoError: result.ok ? "" : (result.code ?? "type"),
    fotoSmallWarning: result.ok && result.small,
    fotoMockName: mock.name ?? null,
    localSource: null
  };
}

export function setLocalSourceSuccess(
  state: CreazaLocalFormState,
  image: LocalSourceImage,
  smallWarning: boolean
): CreazaLocalFormState {
  return {
    ...state,
    localSource: image,
    fotoUi: "selected",
    fotoError: "",
    fotoSmallWarning: smallWarning,
    fotoMockName: null
  };
}

export function setLocalSourceFailure(
  state: CreazaLocalFormState,
  code: FotoValidationError
): CreazaLocalFormState {
  return {
    ...state,
    localSource: null,
    fotoUi: "error",
    fotoError: code || "type",
    fotoSmallWarning: false,
    fotoMockName: null
  };
}

export function clearLocalSource(state: CreazaLocalFormState): CreazaLocalFormState {
  return {
    ...state,
    localSource: null,
    fotoUi: "empty",
    fotoError: "",
    fotoSmallWarning: false,
    fotoMockName: null
  };
}

export function setFotoDragOver(state: CreazaLocalFormState): CreazaLocalFormState {
  return { ...state, fotoUi: "drag-over" };
}

export function continueFromPreset(state: CreazaLocalFormState): CreazaLocalFormState {
  if (!state.preset) {
    return { ...state, presetError: "select", presetBusy: false };
  }
  return {
    ...state,
    presetError: "",
    presetBusy: false,
    step: "foto"
  };
}

export function continueFromFoto(state: CreazaLocalFormState): CreazaLocalFormState {
  const hasReal = Boolean(state.localSource) && !state.fotoError;
  const hasFixture =
    !state.localSource &&
    (state.fotoUi === "selected" || state.fotoUi === "loading") &&
    !state.fotoError;

  if (!hasReal && !hasFixture) {
    return {
      ...state,
      fotoError: state.fotoError || "type",
      fotoUi: state.fotoError ? state.fotoUi : "error"
    };
  }
  return { ...state, step: "experienta" };
}

export function continueFromExperienta(state: CreazaLocalFormState): CreazaLocalFormState {
  return { ...state, step: "confirmare" };
}

export function goBack(state: CreazaLocalFormState): CreazaLocalFormState {
  if (state.step === "foto") return { ...state, step: "preset" };
  if (state.step === "experienta") return { ...state, step: "foto" };
  if (state.step === "confirmare") return { ...state, step: "experienta" };
  return state;
}

export function selectExperience(
  state: CreazaLocalFormState,
  experience: ExperienceChoice
): CreazaLocalFormState {
  return { ...state, experience };
}

export function resetCreazaForm(): CreazaLocalFormState {
  return createInitialCreazaFormState();
}

export function isWritePathBlocked(url: string): boolean {
  return (
    url.includes("/api/projects") ||
    url.includes("/api/auth/magic-link") ||
    url.includes("/api/publish")
  );
}

export function fotoDisplayName(state: CreazaLocalFormState): string {
  if (state.localSource) return state.localSource.name;
  if (state.fotoMockName) return state.fotoMockName;
  return "Neales";
}
