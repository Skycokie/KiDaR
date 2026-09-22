"use client";

import { useEffect, useId, useMemo, useReducer, useRef } from "react";
import { SOURCE_ACCEPT, type SimpleCreatorPreset } from "@/lib/simple-creator";
import { CreazaArt } from "./art";
import { buildCreateProjectPayload, postCreateProject } from "./create-project";
import {
  COPY,
  CREAZA_STEPS,
  EXPERIENCE_DOORS,
  FOTO_FIXTURE_LABELS,
  PRESET_DOORS,
  TOTAL_STEPS,
  type FotoFixtureState
} from "./fixtures";
import {
  applyFotoFixture,
  beginPresetCreate,
  beginSceneSave,
  beginSourceUpload,
  clearLocalSource,
  completePresetCreate,
  completeSceneSave,
  completeSourceUpload,
  createInitialCreazaFormState,
  decidePresetCta,
  decideSceneCta,
  decideSourceCta,
  failPresetCreate,
  failSceneSave,
  failSourceUpload,
  FOTO_ERROR_COPY,
  fotoDisplayName,
  goBack,
  PRESET_ERROR_COPY,
  resetCreazaForm,
  resumeExistingDraft,
  SCENE_ERROR_COPY,
  selectExperience,
  selectPreset,
  setFotoDragOver,
  setLocalSourceFailure,
  setLocalSourceSuccess,
  UPLOAD_ERROR_COPY,
  type CreazaLocalFormState,
  type SceneError,
  type UploadError
} from "./form-state";
import {
  buildLocalSourceImage,
  pickFirstImageFile,
  type LocalSourceImage
} from "./local-source";
import { SiteHeader } from "@/components/site-nav";
import { patchSceneMode } from "./save-scene";
import { postSourceUpload } from "./upload-source";
import "./creaza-preview.css";
const PRESET_TITLES: Record<string, string> = Object.fromEntries(
  PRESET_DOORS.map((door) => [door.id, door.title])
);

type Action =
  | { type: "select-preset"; preset: SimpleCreatorPreset }
  | { type: "begin-create" }
  | { type: "resume-draft" }
  | { type: "complete-create"; projectId: string }
  | { type: "fail-create"; error: "auth" | "quota" | "generic" | "ambiguous" }
  | { type: "foto-fixture"; ui: FotoFixtureState }
  | { type: "foto-drag-over" }
  | { type: "local-success"; image: LocalSourceImage; smallWarning: boolean }
  | { type: "local-failure"; code: "type" | "size" }
  | { type: "local-clear" }
  | { type: "begin-upload" }
  | { type: "complete-upload"; sourceUrl: string }
  | { type: "fail-upload"; error: Exclude<UploadError, ""> }
  | { type: "select-experience"; experience: "popout" | "gallery" }
  | { type: "begin-scene" }
  | { type: "complete-scene" }
  | { type: "fail-scene"; error: Exclude<SceneError, ""> }
  | { type: "back" }
  | { type: "reset" };

function reducer(state: CreazaLocalFormState, action: Action): CreazaLocalFormState {
  switch (action.type) {
    case "select-preset":
      return selectPreset(state, action.preset);
    case "begin-create":
      return beginPresetCreate(state);
    case "resume-draft":
      return resumeExistingDraft(state);
    case "complete-create":
      return completePresetCreate(state, action.projectId);
    case "fail-create":
      return failPresetCreate(state, action.error);
    case "foto-fixture":
      return applyFotoFixture(state, action.ui);
    case "foto-drag-over":
      return setFotoDragOver(state);
    case "local-success":
      return setLocalSourceSuccess(state, action.image, action.smallWarning);
    case "local-failure":
      return setLocalSourceFailure(state, action.code);
    case "local-clear":
      return clearLocalSource(state);
    case "begin-upload":
      return beginSourceUpload(state);
    case "complete-upload":
      return completeSourceUpload(state, action.sourceUrl);
    case "fail-upload":
      return failSourceUpload(state, action.error);
    case "select-experience":
      return selectExperience(state, action.experience);
    case "begin-scene":
      return beginSceneSave(state);
    case "complete-scene":
      return completeSceneSave(state);
    case "fail-scene":
      return failSceneSave(state, action.error);
    case "back":
      return goBack(state);
    case "reset":
      return resetCreazaForm();
    default:
      return state;
  }
}

/**
 * Atelier preview: Create Go B + Source Go B + Scene Go B.
 * Publish remains blocked. Scene PATCH is `{ mode: "popout" }` only.
 */
export function CreazaPreviewShell() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialCreazaFormState);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);
  const sceneInFlightRef = useRef(false);
  const stepMeta = useMemo(() => CREAZA_STEPS.find((item) => item.id === state.step)!, [state.step]);
  useEffect(() => {
    const url = state.localSource?.objectUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.localSource?.objectUrl]);

  async function ingestFile(file: File | null) {
    if (!file || state.fotoBusy) return;
    const result = await buildLocalSourceImage(file);
    if (!result.ok) {
      dispatch({ type: "local-failure", code: result.code });
      return;
    }
    dispatch({ type: "local-success", image: result.image, smallWarning: result.smallWarning });
  }

  async function startWorld() {
    if (createInFlightRef.current || state.presetBusy || state.fotoBusy || state.sceneBusy) return;

    const decision = decidePresetCta(state);
    if (decision.kind === "select-error") {
      dispatch({ type: "begin-create" });
      return;
    }

    if (decision.kind === "resume") {
      dispatch({ type: "resume-draft" });
      return;
    }

    createInFlightRef.current = true;
    dispatch({ type: "begin-create" });

    const payload = buildCreateProjectPayload(decision.preset);
    const result = await postCreateProject(payload);

    createInFlightRef.current = false;
    if (result.ok) {
      dispatch({ type: "complete-create", projectId: result.projectId });
      return;
    }
    dispatch({ type: "fail-create", error: result.error });
  }

  async function savePhoto() {
    if (uploadInFlightRef.current || state.fotoBusy || state.presetBusy || state.sceneBusy) return;

    const decision = decideSourceCta(state);
    if (decision.kind !== "upload") {
      dispatch({ type: "begin-upload" });
      return;
    }

    uploadInFlightRef.current = true;
    dispatch({ type: "begin-upload" });

    const result = await postSourceUpload(decision.projectId, decision.file);

    uploadInFlightRef.current = false;
    if (result.ok) {
      dispatch({ type: "complete-upload", sourceUrl: result.sourceUrl });
      return;
    }
    dispatch({ type: "fail-upload", error: result.error });
  }

  async function saveScene() {
    if (sceneInFlightRef.current || state.sceneBusy || state.fotoBusy || state.presetBusy) return;

    const decision = decideSceneCta(state);
    if (decision.kind !== "patch") {
      dispatch({ type: "begin-scene" });
      return;
    }

    sceneInFlightRef.current = true;
    dispatch({ type: "begin-scene" });

    const result = await patchSceneMode(decision.projectId);

    sceneInFlightRef.current = false;
    if (result.ok) {
      dispatch({ type: "complete-scene" });
      return;
    }
    dispatch({ type: "fail-scene", error: result.error });
  }

  const dropLocked = state.fotoBusy;
  const sceneLocked = state.sceneBusy;
  const fotoAlert =
    state.uploadError && UPLOAD_ERROR_COPY[state.uploadError]
      ? UPLOAD_ERROR_COPY[state.uploadError]
      : state.fotoError
        ? FOTO_ERROR_COPY[state.fotoError]
        : null;
  const sceneAlert =
    state.sceneError && SCENE_ERROR_COPY[state.sceneError] ? SCENE_ERROR_COPY[state.sceneError] : null;

  return (
    <div className="creaza-preview" data-creaza-mode="scene-go-b">      <a className="creaza-preview__skip" href="#creaza-preview-main">
        Sari la conținut
      </a>

      <SiteHeader
        brandHref="/studio"
        studioHref="/studio-preview/personalizeaza"
        trailing={<p className="creaza-preview__badge">{COPY.previewBadge}</p>}
      />

      <main id="creaza-preview-main" className="creaza-preview__main">
        <ol className="creaza-progress" aria-label={`Progres: pasul ${stepMeta.index} din ${TOTAL_STEPS}`}>
          {CREAZA_STEPS.map((item) => {
            const currentIndex = stepMeta.index;
            const klass =
              item.index < currentIndex ? "is-done" : item.index === currentIndex ? "is-current" : "";
            return (
              <li
                key={item.id}
                className={klass || undefined}
                aria-current={klass === "is-current" ? "step" : undefined}
              >
                <span>
                  {item.index} / {TOTAL_STEPS}
                </span>
                {item.short}
              </li>
            );
          })}
        </ol>

        {state.step === "preset" ? (
          <section aria-labelledby="creaza-preset-title" aria-busy={state.presetBusy}>
            <p className="creaza-kicker">{COPY.brandKicker}</p>
            <h1 id="creaza-preset-title" className="creaza-title">
              {COPY.preset.title}
            </h1>
            <p className="creaza-lead">{COPY.preset.lead}</p>

            <div className="creaza-doors" role="listbox" aria-label="Punct de pornire">
              {PRESET_DOORS.map((door) => (
                <button
                  key={door.id}
                  type="button"
                  role="option"
                  aria-selected={state.preset === door.id}
                  className={`creaza-door${state.preset === door.id ? " is-selected" : ""}`}
                  disabled={state.presetBusy}
                  onClick={() => dispatch({ type: "select-preset", preset: door.id })}
                >
                  <span className="creaza-door__art">
                    <CreazaArt kind={door.art} />
                  </span>
                  <span className="creaza-door__copy">
                    <strong>{door.title}</strong>
                    <em>{door.detail}</em>
                  </span>
                </button>
              ))}
            </div>

            {state.presetError ? (
              <p className="creaza-inline-error" role="alert">
                {PRESET_ERROR_COPY[state.presetError]}
              </p>
            ) : null}

            <p className="creaza-status" role="status" aria-live="polite">
              {state.presetBusy ? COPY.preset.ctaBusy : ""}
            </p>

            <div className="creaza-actions">
              <button
                type="button"
                className="creaza-cta"
                disabled={state.presetBusy}
                onClick={() => void startWorld()}
              >
                {state.presetBusy ? COPY.preset.ctaBusy : COPY.preset.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "foto" ? (
          <section aria-labelledby="creaza-foto-title" aria-busy={state.fotoBusy}>
            <p className="creaza-kicker">{COPY.brandKicker}</p>
            <h1 id="creaza-foto-title" className="creaza-title">
              {COPY.foto.title}
            </h1>
            <p className="creaza-lead">{COPY.foto.lead}</p>

            <input
              ref={fileInputRef}
              id={fileInputId}
              className="creaza-file-input"
              type="file"
              accept={SOURCE_ACCEPT}
              disabled={dropLocked}
              onChange={(event) => {
                const file = pickFirstImageFile(event.target.files);
                void ingestFile(file);
                event.target.value = "";
              }}
            />

            <div className="creaza-table">
              <div
                className={`creaza-drop${
                  state.fotoUi === "drag-over"
                    ? " is-drag-over"
                    : state.localSource || state.fotoUi === "selected" || state.fotoUi === "loading"
                      ? " is-selected"
                      : state.fotoUi === "error"
                        ? " is-error"
                        : ""
                }`}
                role="button"
                tabIndex={dropLocked ? -1 : 0}
                aria-disabled={dropLocked || undefined}
                aria-controls={fileInputId}
                aria-label={
                  fotoAlert ??
                  (state.localSource ? COPY.foto.dropSelected : COPY.foto.dropEmpty)
                }
                onClick={() => {
                  if (dropLocked) return;
                  fileInputRef.current?.click();
                }}
                onKeyDown={(event) => {
                  if (dropLocked) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (dropLocked) return;
                  dispatch({ type: "foto-drag-over" });
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (dropLocked) return;
                  if (!state.localSource) {
                    dispatch({ type: "foto-fixture", ui: "empty" });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dropLocked) return;
                  const file = pickFirstImageFile(event.dataTransfer.files);
                  void ingestFile(file);
                }}
              >
                {state.localSource && !state.fotoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="creaza-drop__preview"
                    src={state.localSource.objectUrl}
                    alt={`Previzualizare poză: ${state.localSource.name}`}
                  />
                ) : (state.fotoUi === "selected" || state.fotoUi === "loading") && !state.fotoError ? (
                  <div className="creaza-drop__paper">
                    <CreazaArt kind="paper" />
                  </div>
                ) : null}

                <p className="creaza-drop__label">
                  {fotoAlert
                    ? fotoAlert
                    : state.localSource
                      ? COPY.foto.dropSelected
                      : state.fotoUi === "loading"
                        ? COPY.foto.dropLoading
                        : state.fotoUi === "drag-over"
                          ? "Trage poza aici"
                          : COPY.foto.dropEmpty}
                </p>
                <p className="creaza-drop__hint">
                  {state.localSource
                    ? `${state.localSource.name} · ${(state.localSource.sizeBytes / 1024).toFixed(0)} KB${
                        state.localSource.width && state.localSource.height
                          ? ` · ${state.localSource.width}×${state.localSource.height}`
                          : ""
                      }`
                    : state.fotoMockName
                      ? `Fixture: ${state.fotoMockName}`
                      : COPY.foto.dropHint}
                </p>
                {state.fotoSmallWarning ? (
                  <p className="creaza-drop__hint" role="status">
                    Fotografia pare foarte mică — același avertisment ca în fluxul real.
                  </p>
                ) : null}
              </div>

              <ul className="creaza-tips">
                {COPY.foto.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>

            {fotoAlert ? (
              <p className="creaza-inline-error" role="alert">
                {fotoAlert}
              </p>
            ) : null}

            <p className="creaza-status" role="status" aria-live="polite">
              {state.fotoBusy ? COPY.foto.ctaBusy : ""}
            </p>

            <div className="creaza-fixture-bar" role="group" aria-label="Stări fixture (opțional)">
              {(Object.keys(FOTO_FIXTURE_LABELS) as FotoFixtureState[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={dropLocked}
                  className={!state.localSource && state.fotoUi === key ? "is-active" : undefined}
                  onClick={() => dispatch({ type: "foto-fixture", ui: key })}
                >
                  {FOTO_FIXTURE_LABELS[key]}
                </button>
              ))}
              {state.localSource ? (
                <button
                  type="button"
                  disabled={dropLocked}
                  onClick={() => dispatch({ type: "local-clear" })}
                >
                  Elimină poza
                </button>
              ) : null}
            </div>

            <div className="creaza-actions">
              <button
                type="button"
                className="creaza-ghost"
                disabled={dropLocked}
                onClick={() => dispatch({ type: "back" })}
              >
                {COPY.foto.back}
              </button>
              <button
                type="button"
                className="creaza-cta"
                disabled={dropLocked}
                onClick={() => void savePhoto()}
              >
                {state.fotoBusy ? COPY.foto.ctaBusy : COPY.foto.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "experienta" ? (
          <section aria-labelledby="creaza-exp-title" aria-busy={state.sceneBusy}>
            <p className="creaza-kicker">{COPY.brandKicker}</p>
            <h1 id="creaza-exp-title" className="creaza-title">
              {COPY.experienta.title}
            </h1>
            <p className="creaza-lead">{COPY.experienta.lead}</p>

            <div className="creaza-scene-grid">
              {EXPERIENCE_DOORS.map((door) => {
                const soon = "soon" in door && door.soon;
                return (
                  <button
                    key={door.id}
                    type="button"
                    className={`creaza-scene${state.experience === door.id ? " is-selected" : ""}${
                      soon ? " is-soon" : ""
                    }`}
                    disabled={Boolean(soon) || sceneLocked}
                    aria-pressed={state.experience === door.id}
                    onClick={() => {
                      if (soon || sceneLocked) return;
                      dispatch({ type: "select-experience", experience: door.id });
                    }}
                  >
                    {soon ? <span className="creaza-door__soon">În curând</span> : null}
                    <strong>{door.title}</strong>
                    <em>{door.detail}</em>
                  </button>
                );
              })}
            </div>

            {sceneAlert ? (
              <p className="creaza-inline-error" role="alert">
                {sceneAlert}
              </p>
            ) : null}

            <div className="creaza-actions">
              <button
                type="button"
                className="creaza-ghost"
                disabled={sceneLocked}
                onClick={() => dispatch({ type: "back" })}
              >
                {COPY.experienta.back}
              </button>
              <button
                type="button"
                className="creaza-cta"
                disabled={sceneLocked}
                onClick={() => void saveScene()}
              >
                {state.sceneBusy ? COPY.experienta.ctaBusy : COPY.experienta.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "confirmare" ? (
          <section aria-labelledby="creaza-done-title">
            <p className="creaza-kicker">{COPY.brandKicker}</p>
            <h1 id="creaza-done-title" className="creaza-title">
              {COPY.confirmare.title}
            </h1>
            <p className="creaza-lead">{COPY.confirmare.lead}</p>

            <div className="creaza-summary">
              <div className="creaza-summary__art">
                {state.localSource ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="creaza-drop__preview"
                    src={state.localSource.objectUrl}
                    alt={`Previzualizare poză: ${state.localSource.name}`}
                  />
                ) : (
                  <CreazaArt kind="paper" />
                )}
              </div>
              <dl>
                <div>
                  <dt>{COPY.confirmare.summaryPreset}</dt>
                  <dd>{state.preset ? PRESET_TITLES[state.preset] : "—"}</dd>
                </div>
                <div>
                  <dt>{COPY.confirmare.summaryFoto}</dt>
                  <dd>{fotoDisplayName(state)}</dd>
                </div>
                <div>
                  <dt>{COPY.confirmare.summaryScene}</dt>
                  <dd>{EXPERIENCE_DOORS.find((d) => d.id === state.experience)?.title ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <p className="creaza-note">{COPY.confirmare.note}</p>

            <div className="creaza-actions">
              <button type="button" className="creaza-cta" onClick={() => dispatch({ type: "reset" })}>
                {COPY.confirmare.again}
              </button>
              <a
                className="creaza-ghost"
                href={
                  state.projectId
                    ? `/studio-preview/personalizeaza?projectId=${encodeURIComponent(state.projectId)}`
                    : "/studio-preview/personalizeaza"
                }
              >
                {COPY.confirmare.atelier}
              </a>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
