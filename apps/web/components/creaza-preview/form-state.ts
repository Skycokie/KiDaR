/**
 * Local form state for `/creaza-preview`.
 * Create Go B: POST /api/projects once from preset CTA.
 * Source Go B: POST …/source once from explicit photo save CTA.
 * Scene Go B: PATCH …/:projectId once with `{ mode: "popout" }` from scene CTA.
 * Publish remains blocked.
 */

import {
  validateSourceImage,
  type ExperienceChoice,
  type SimpleCreatorPreset
} from "@/lib/simple-creator";
import type { CreateProjectClientError } from "./create-project";
import type { CreazaPreviewStep, FotoFixtureState } from "./fixtures";
import type { LocalSourceImage } from "./local-source";
import { isProjectPatchPath, isWritableScene, type SceneSaveClientError } from "./save-scene";
import { isSourceUploadPath, type SourceUploadClientError } from "./upload-source";

export type PresetError = "" | CreateProjectClientError;
export type FotoValidationError = "" | "type" | "size";
export type UploadError =
  | ""
  | Exclude<SourceUploadClientError, "type" | "size">
  | "type"
  | "size";
export type SceneError = "" | SceneSaveClientError;
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
  /** Only ProjectRecord.id — never the full project document. */
  projectId: string | null;
  fotoUi: FotoFixtureState;
  fotoError: FotoValidationError;
  fotoSmallWarning: boolean;
  fotoMockName: string | null;
  /** Real browser File held only in page memory (Object URL). */
  localSource: LocalSourceImage | null;
  fotoBusy: boolean;
  uploadError: UploadError;
  /** Proxied display URL after Source Go B — never full ProjectRecord. */
  sourceUrl: string | null;
  experience: ExperienceChoice;
  sceneBusy: boolean;
  sceneError: SceneError;
};

export const PRESET_ERROR_COPY: Record<Exclude<PresetError, "">, string> = {
  select: "Alege cu ce începe lumea.",
  auth: "Trebuie să fii autentificat ca să începi lumea.",
  quota: "Ai folosit surprizele din planul gratuit. Poți folosi Studio pentru proiectele existente.",
  generic: "Nu am putut începe lumea. Încearcă din nou.",
  ambiguous:
    "Nu am putut confirma dacă lumea a fost creată. Verifică galeria lumilor înainte să încerci din nou — un retry automat ar putea crea un draft în plus."
};

export const FOTO_ERROR_COPY: Record<Exclude<FotoValidationError, "">, string> = {
  type: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB.",
  size: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB."
};

export const UPLOAD_ERROR_COPY: Record<Exclude<UploadError, "">, string> = {
  "missing-project": "Lumea nu este pregătită încă. Întoarce-te și apasă „Începe lumea”.",
  "missing-photo": "Alege mai întâi o poză JPG sau PNG.",
  type: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB.",
  size: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB.",
  auth: "Trebuie să fii autentificat ca să salvezi poza.",
  "not-found": "Lumea nu mai este disponibilă.",
  generic: "Nu am putut salva poza. Încearcă din nou.",
  network: "Nu am putut salva poza. Verifică conexiunea și încearcă din nou."
};

export const SCENE_ERROR_COPY: Record<Exclude<SceneError, "">, string> = {
  "missing-project": "Lumea nu este pregătită încă. Întoarce-te și apasă „Începe lumea”.",
  "invalid-scene": "Alege Popout ca să continui. Figurină vine în curând.",
  auth: "Trebuie să fii autentificat ca să salvezi scena.",
  "not-found": "Lumea nu mai este disponibilă.",
  "bad-request": "Nu am putut salva scena. Încearcă din nou.",
  generic: "Nu am putut salva scena. Încearcă din nou.",
  network: "Nu am putut salva scena. Verifică conexiunea și încearcă din nou."
};

export function createInitialCreazaFormState(): CreazaLocalFormState {
  return {
    step: "preset",
    preset: null,
    presetError: "",
    presetBusy: false,
    projectId: null,
    fotoUi: "empty",
    fotoError: "",
    fotoSmallWarning: false,
    fotoMockName: null,
    localSource: null,
    fotoBusy: false,
    uploadError: "",
    sourceUrl: null,
    experience: "popout",
    sceneBusy: false,
    sceneError: ""
  };
}

function anyBusy(state: CreazaLocalFormState): boolean {
  return state.presetBusy || state.fotoBusy || state.sceneBusy;
}

export function selectPreset(
  state: CreazaLocalFormState,
  preset: SimpleCreatorPreset
): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  return { ...state, preset, presetError: "" };
}

/**
 * Validates preset and marks create in-flight. Does not navigate and does not fetch.
 * Second call while busy is a no-op (double-submit guard).
 * Call only when `projectId` is absent — use `resumeExistingDraft` otherwise.
 */
export function beginPresetCreate(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  if (!state.preset) {
    return { ...state, presetError: "select", presetBusy: false };
  }
  if (state.projectId) {
    return resumeExistingDraft(state);
  }
  return {
    ...state,
    presetError: "",
    presetBusy: true
  };
}

/**
 * Create Go B amendment: reuse an existing preview `projectId` without any network.
 * Preserves local File / Object URL memory. Does not fetch ProjectRecord.
 */
export function resumeExistingDraft(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  if (!state.preset) {
    return { ...state, presetError: "select", presetBusy: false };
  }
  if (!state.projectId) {
    return state;
  }
  return {
    ...state,
    presetError: "",
    presetBusy: false,
    step: "foto"
  };
}

export type PresetCtaDecision =
  | { kind: "select-error" }
  | { kind: "resume"; projectId: string }
  | { kind: "create"; preset: SimpleCreatorPreset };

/** Pure CTA decision — no side effects. */
export function decidePresetCta(state: CreazaLocalFormState): PresetCtaDecision {
  if (!state.preset) return { kind: "select-error" };
  if (state.projectId) return { kind: "resume", projectId: state.projectId };
  return { kind: "create", preset: state.preset };
}

export function completePresetCreate(
  state: CreazaLocalFormState,
  projectId: string
): CreazaLocalFormState {
  return {
    ...state,
    projectId,
    presetError: "",
    presetBusy: false,
    step: "foto"
  };
}

export function failPresetCreate(
  state: CreazaLocalFormState,
  error: Exclude<CreateProjectClientError, "select">
): CreazaLocalFormState {
  return {
    ...state,
    presetBusy: false,
    presetError: error,
    step: "preset"
  };
}

/**
 * Fixture bar / drag-over chrome. Clears any real localSource reference
 * (caller must revoke the previous Object URL via effect).
 */
export function applyFotoFixture(
  state: CreazaLocalFormState,
  ui: FotoFixtureState
): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  const mock = FOTO_MOCK_FILES[ui];
  if (!mock) {
    return {
      ...state,
      fotoUi: ui,
      fotoError: "",
      fotoSmallWarning: false,
      fotoMockName: null,
      localSource: null,
      uploadError: "",
      sourceUrl: null
    };
  }
  const result = validateSourceImage(mock);
  return {
    ...state,
    fotoUi: ui,
    fotoError: result.ok ? "" : (result.code ?? "type"),
    fotoSmallWarning: result.ok && result.small,
    fotoMockName: mock.name ?? null,
    localSource: null,
    uploadError: "",
    sourceUrl: null
  };
}

export function setLocalSourceSuccess(
  state: CreazaLocalFormState,
  image: LocalSourceImage,
  smallWarning: boolean
): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  return {
    ...state,
    localSource: image,
    fotoUi: "selected",
    fotoError: "",
    fotoSmallWarning: smallWarning,
    fotoMockName: null,
    uploadError: "",
    sourceUrl: null
  };
}

export function setLocalSourceFailure(
  state: CreazaLocalFormState,
  code: FotoValidationError
): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  return {
    ...state,
    localSource: null,
    fotoUi: "error",
    fotoError: code || "type",
    fotoSmallWarning: false,
    fotoMockName: null,
    uploadError: "",
    sourceUrl: null
  };
}

export function clearLocalSource(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  return {
    ...state,
    localSource: null,
    fotoUi: "empty",
    fotoError: "",
    fotoSmallWarning: false,
    fotoMockName: null,
    uploadError: "",
    sourceUrl: null
  };
}

export function setFotoDragOver(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  return { ...state, fotoUi: "drag-over" };
}

export type SourceCtaDecision =
  | { kind: "missing-project" }
  | { kind: "missing-photo" }
  | { kind: "invalid-photo"; code: "type" | "size" }
  | { kind: "upload"; projectId: string; file: File };

export function decideSourceCta(state: CreazaLocalFormState): SourceCtaDecision {
  if (!state.projectId) return { kind: "missing-project" };
  if (!state.localSource) return { kind: "missing-photo" };
  const check = validateSourceImage(state.localSource.file);
  if (!check.ok) {
    return { kind: "invalid-photo", code: check.code ?? "type" };
  }
  return { kind: "upload", projectId: state.projectId, file: state.localSource.file };
}

export function beginSourceUpload(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  const decision = decideSourceCta(state);
  if (decision.kind === "missing-project") {
    return { ...state, uploadError: "missing-project", fotoBusy: false };
  }
  if (decision.kind === "missing-photo") {
    return {
      ...state,
      uploadError: "missing-photo",
      fotoError: state.fotoError || "type",
      fotoUi: state.fotoError ? state.fotoUi : "error",
      fotoBusy: false
    };
  }
  if (decision.kind === "invalid-photo") {
    return {
      ...state,
      uploadError: decision.code,
      fotoError: decision.code,
      fotoUi: "error",
      fotoBusy: false
    };
  }
  return {
    ...state,
    uploadError: "",
    fotoError: "",
    fotoBusy: true,
    fotoUi: "loading"
  };
}

export function completeSourceUpload(
  state: CreazaLocalFormState,
  sourceUrl: string
): CreazaLocalFormState {
  return {
    ...state,
    sourceUrl,
    fotoBusy: false,
    uploadError: "",
    fotoUi: "selected",
    step: "experienta"
  };
}

export function failSourceUpload(
  state: CreazaLocalFormState,
  error: Exclude<UploadError, "">
): CreazaLocalFormState {
  return {
    ...state,
    fotoBusy: false,
    uploadError: error,
    fotoUi: state.localSource ? "selected" : "error",
    step: "foto"
  };
}

export type SceneCtaDecision =
  | { kind: "missing-project" }
  | { kind: "invalid-scene" }
  | { kind: "patch"; projectId: string };

export function decideSceneCta(state: CreazaLocalFormState): SceneCtaDecision {
  if (!state.projectId) return { kind: "missing-project" };
  if (!isWritableScene(state.experience)) return { kind: "invalid-scene" };
  return { kind: "patch", projectId: state.projectId };
}

/**
 * Marks scene PATCH in-flight. Selection alone does not call this.
 * Second call while busy is a no-op (double-submit guard).
 */
export function beginSceneSave(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  const decision = decideSceneCta(state);
  if (decision.kind === "missing-project") {
    return { ...state, sceneError: "missing-project", sceneBusy: false };
  }
  if (decision.kind === "invalid-scene") {
    return { ...state, sceneError: "invalid-scene", sceneBusy: false };
  }
  return {
    ...state,
    sceneError: "",
    sceneBusy: true
  };
}

export function completeSceneSave(state: CreazaLocalFormState): CreazaLocalFormState {
  return {
    ...state,
    sceneBusy: false,
    sceneError: "",
    step: "confirmare"
  };
}

export function failSceneSave(
  state: CreazaLocalFormState,
  error: Exclude<SceneError, "">
): CreazaLocalFormState {
  return {
    ...state,
    sceneBusy: false,
    sceneError: error,
    step: "experienta"
  };
}

export function goBack(state: CreazaLocalFormState): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  if (state.step === "foto") return { ...state, step: "preset", uploadError: "" };
  if (state.step === "experienta") return { ...state, step: "foto", sceneError: "" };
  if (state.step === "confirmare") return { ...state, step: "experienta" };
  return state;
}

export function selectExperience(
  state: CreazaLocalFormState,
  experience: ExperienceChoice
): CreazaLocalFormState {
  if (anyBusy(state)) return state;
  return { ...state, experience, sceneError: "" };
}

export function resetCreazaForm(): CreazaLocalFormState {
  return createInitialCreazaFormState();
}

/**
 * Paths still forbidden after Create + Source + Scene Go B.
 * Allowed: POST /api/projects, POST …/source, PATCH /api/projects/:id (mode only at call site).
 * Blocked: publish, magic-link, other project subpaths (asset, etc.).
 */
export function isWritePathBlocked(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";

  if (path === "/api/projects") return false;
  if (isSourceUploadPath(path)) return false;
  if (isProjectPatchPath(path)) return false;
  if (path.startsWith("/api/projects/")) return true;
  if (path === "/api/auth/magic-link" || path.startsWith("/api/auth/magic-link/")) return true;
  if (path === "/api/publish" || path.startsWith("/api/publish/")) return true;
  return false;
}

export function isCreateProjectAllowed(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";
  return path === "/api/projects";
}

export function fotoDisplayName(state: CreazaLocalFormState): string {
  if (state.localSource) return state.localSource.name;
  if (state.fotoMockName) return state.fotoMockName;
  return "Neales";
}
