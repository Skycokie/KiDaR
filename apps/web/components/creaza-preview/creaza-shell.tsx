"use client";

import { useEffect, useId, useMemo, useReducer, useRef } from "react";
import { SOURCE_ACCEPT, type SimpleCreatorPreset } from "@/lib/simple-creator";
import { CreazaArt } from "./art";
import { buildCreateProjectPayload, postCreateProject } from "./create-project";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { hrefForLocale } from "@/i18n/locale";
import {
  CREAZA_STEPS,
  EXPERIENCE_DOORS,
  FOTO_FIXTURE_STATES,
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
  fotoDisplayName,
  fotoErrorText,
  goBack,
  presetErrorText,
  resetCreazaForm,
  resumeExistingDraft,
  sceneErrorText,
  selectExperience,
  selectPreset,
  setFotoDragOver,
  setLocalSourceFailure,
  setLocalSourceSuccess,
  uploadErrorText,
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
export function CreazaPreviewShell({ locale = "ro" }: { locale?: Locale }) {
  const messages = getMessages(locale);
  const t = messages.creaza;
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

    const payload = buildCreateProjectPayload(decision.preset, new Date(), locale);
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
  const fotoAlert = state.uploadError
    ? uploadErrorText(t.errors, state.uploadError)
    : state.fotoError
      ? fotoErrorText(t.errors)
      : null;
  const sceneAlert = state.sceneError ? sceneErrorText(t.errors, state.sceneError) : null;
  const previewAlt = (name: string) => t.foto.previewAlt.replace("{name}", name);

  return (
    <div className="creaza-preview" data-creaza-mode="scene-go-b">
      <a className="creaza-preview__skip" href="#creaza-preview-main">
        {messages.accessibility.skipToContent}
      </a>

      <SiteHeader
        brandHref="/studio"
        studioHref="/studio"
        locale={locale}
        menuLabel={messages.accessibility.menu}
        languageLabel={messages.accessibility.languageSelector}
        navLabel={messages.worlds.nav.main}
        trailing={<p className="creaza-preview__badge">{t.previewBadge}</p>}
      />

      <main id="creaza-preview-main" className="creaza-preview__main">
        <ol
          className="creaza-progress"
          aria-label={t.progressLabel
            .replace("{current}", String(stepMeta.index))
            .replace("{total}", String(TOTAL_STEPS))}
        >
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
                {t.steps[item.id]}
              </li>
            );
          })}
        </ol>

        {state.step === "preset" ? (
          <section aria-labelledby="creaza-preset-title" aria-busy={state.presetBusy}>
            <p className="creaza-kicker">{t.brandKicker}</p>
            <h1 id="creaza-preset-title" className="creaza-title">
              {t.preset.title}
            </h1>
            <p className="creaza-lead">{t.preset.lead}</p>

            <div className="creaza-doors" role="listbox" aria-label={t.preset.doorsLabel}>
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
                    <strong>{t.preset.doors[door.id].title}</strong>
                    <em>{t.preset.doors[door.id].detail}</em>
                  </span>
                </button>
              ))}
            </div>

            {state.presetError ? (
              <p className="creaza-inline-error" role="alert">
                {presetErrorText(t.errors, state.presetError)}
              </p>
            ) : null}

            <p className="creaza-status" role="status" aria-live="polite">
              {state.presetBusy ? t.preset.ctaBusy : ""}
            </p>

            <div className="creaza-actions">
              <button
                type="button"
                className="creaza-cta"
                disabled={state.presetBusy}
                onClick={() => void startWorld()}
              >
                {state.presetBusy ? t.preset.ctaBusy : t.preset.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "foto" ? (
          <section aria-labelledby="creaza-foto-title" aria-busy={state.fotoBusy}>
            <p className="creaza-kicker">{t.brandKicker}</p>
            <h1 id="creaza-foto-title" className="creaza-title">
              {t.foto.title}
            </h1>
            <p className="creaza-lead">{t.foto.lead}</p>

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
                  (state.localSource ? t.foto.dropSelected : t.foto.dropEmpty)
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
                    alt={previewAlt(state.localSource.name)}
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
                      ? t.foto.dropSelected
                      : state.fotoUi === "loading"
                        ? t.foto.dropLoading
                        : state.fotoUi === "drag-over"
                          ? t.foto.dropDragOver
                          : t.foto.dropEmpty}
                </p>
                <p className="creaza-drop__hint">
                  {state.localSource
                    ? `${state.localSource.name} · ${(state.localSource.sizeBytes / 1024).toFixed(0)} KB${
                        state.localSource.width && state.localSource.height
                          ? ` · ${state.localSource.width}×${state.localSource.height}`
                          : ""
                      }`
                    : state.fotoMockName
                      ? `${t.foto.fixturePrefix} ${state.fotoMockName}`
                      : t.foto.dropHint}
                </p>
                {state.fotoSmallWarning ? (
                  <p className="creaza-drop__hint" role="status">
                    {t.foto.smallWarning}
                  </p>
                ) : null}
              </div>

              <ul className="creaza-tips">
                {t.foto.tips.map((tip) => (
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
              {state.fotoBusy ? t.foto.ctaBusy : ""}
            </p>

            <div className="creaza-fixture-bar" role="group" aria-label={t.foto.fixtureBarLabel}>
              {FOTO_FIXTURE_STATES.map((fixture) => (
                <button
                  key={fixture.id}
                  type="button"
                  disabled={dropLocked}
                  className={!state.localSource && state.fotoUi === fixture.id ? "is-active" : undefined}
                  onClick={() => dispatch({ type: "foto-fixture", ui: fixture.id })}
                >
                  {t.foto.fixtureStates[fixture.key]}
                </button>
              ))}
              {state.localSource ? (
                <button
                  type="button"
                  disabled={dropLocked}
                  onClick={() => dispatch({ type: "local-clear" })}
                >
                  {t.foto.removePhoto}
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
                {t.foto.back}
              </button>
              <button
                type="button"
                className="creaza-cta"
                disabled={dropLocked}
                onClick={() => void savePhoto()}
              >
                {state.fotoBusy ? t.foto.ctaBusy : t.foto.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "experienta" ? (
          <section aria-labelledby="creaza-exp-title" aria-busy={state.sceneBusy}>
            <p className="creaza-kicker">{t.brandKicker}</p>
            <h1 id="creaza-exp-title" className="creaza-title">
              {t.experienta.title}
            </h1>
            <p className="creaza-lead">{t.experienta.lead}</p>

            <div className="creaza-scene-grid">
              {EXPERIENCE_DOORS.map((door) => {
                const soon = door.soon;
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
                    {soon ? <span className="creaza-door__soon">{t.experienta.soon}</span> : null}
                    <strong>{t.experienta.doors[door.id].title}</strong>
                    <em>{t.experienta.doors[door.id].detail}</em>
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
                {t.experienta.back}
              </button>
              <button
                type="button"
                className="creaza-cta"
                disabled={sceneLocked}
                onClick={() => void saveScene()}
              >
                {state.sceneBusy ? t.experienta.ctaBusy : t.experienta.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "confirmare" ? (
          <section aria-labelledby="creaza-done-title">
            <p className="creaza-kicker">{t.brandKicker}</p>
            <h1 id="creaza-done-title" className="creaza-title">
              {t.confirmare.title}
            </h1>
            <p className="creaza-lead">{t.confirmare.lead}</p>

            <div className="creaza-summary">
              <div className="creaza-summary__art">
                {state.localSource ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="creaza-drop__preview"
                    src={state.localSource.objectUrl}
                    alt={previewAlt(state.localSource.name)}
                  />
                ) : (
                  <CreazaArt kind="paper" />
                )}
              </div>
              <dl>
                <div>
                  <dt>{t.confirmare.summaryPreset}</dt>
                  <dd>{state.preset ? t.preset.doors[state.preset].title : "—"}</dd>
                </div>
                <div>
                  <dt>{t.confirmare.summaryFoto}</dt>
                  <dd>{fotoDisplayName(state, t.confirmare.notChosen)}</dd>
                </div>
                <div>
                  <dt>{t.confirmare.summaryScene}</dt>
                  <dd>{t.experienta.doors[state.experience]?.title ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <p className="creaza-note">{t.confirmare.note}</p>

            <div className="creaza-actions">
              <button type="button" className="creaza-cta" onClick={() => dispatch({ type: "reset" })}>
                {t.confirmare.again}
              </button>
              <a
                className="creaza-ghost"
                href={
                  state.projectId
                    ? `${hrefForLocale("/studio-preview/personalizeaza", locale)}?projectId=${encodeURIComponent(state.projectId)}`
                    : hrefForLocale("/studio-preview/personalizeaza", locale)
                }
              >
                {t.confirmare.atelier}
              </a>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
