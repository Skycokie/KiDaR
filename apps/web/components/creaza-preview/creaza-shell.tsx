"use client";

import { useEffect, useId, useMemo, useReducer, useRef } from "react";
import { SOURCE_ACCEPT, type SimpleCreatorPreset } from "@/lib/simple-creator";
import { CreazaArt } from "./art";
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
  clearLocalSource,
  continueFromExperienta,
  continueFromFoto,
  continueFromPreset,
  createInitialCreazaFormState,
  FOTO_ERROR_COPY,
  fotoDisplayName,
  goBack,
  PRESET_ERROR_COPY,
  resetCreazaForm,
  selectExperience,
  selectPreset,
  setFotoDragOver,
  setLocalSourceFailure,
  setLocalSourceSuccess,
  type CreazaLocalFormState
} from "./form-state";
import {
  buildLocalSourceImage,
  pickFirstImageFile,
  type LocalSourceImage
} from "./local-source";
import "./creaza-preview.css";

const PRESET_TITLES: Record<string, string> = Object.fromEntries(
  PRESET_DOORS.map((door) => [door.id, door.title])
);

type Action =
  | { type: "select-preset"; preset: SimpleCreatorPreset }
  | { type: "continue-preset" }
  | { type: "foto-fixture"; ui: FotoFixtureState }
  | { type: "foto-drag-over" }
  | { type: "local-success"; image: LocalSourceImage; smallWarning: boolean }
  | { type: "local-failure"; code: "type" | "size" }
  | { type: "local-clear" }
  | { type: "continue-foto" }
  | { type: "select-experience"; experience: "popout" | "gallery" }
  | { type: "continue-experience" }
  | { type: "back" }
  | { type: "reset" };

function reducer(state: CreazaLocalFormState, action: Action): CreazaLocalFormState {
  switch (action.type) {
    case "select-preset":
      return selectPreset(state, action.preset);
    case "continue-preset":
      return continueFromPreset(state);
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
    case "continue-foto":
      return continueFromFoto(state);
    case "select-experience":
      return selectExperience(state, action.experience);
    case "continue-experience":
      return continueFromExperienta(state);
    case "back":
      return goBack(state);
    case "reset":
      return resetCreazaForm();
    default:
      return state;
  }
}

/**
 * Atelier UI + local form state + in-memory File preview.
 * No fetch, upload, magic-link, or production `/creaza/*` changes.
 */
export function CreazaPreviewShell() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialCreazaFormState);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepMeta = useMemo(() => CREAZA_STEPS.find((item) => item.id === state.step)!, [state.step]);

  // Revoke previous Object URL when replaced/cleared/unmounted.
  useEffect(() => {
    const url = state.localSource?.objectUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.localSource?.objectUrl]);

  async function ingestFile(file: File | null) {
    if (!file) return;
    const result = await buildLocalSourceImage(file);
    if (!result.ok) {
      dispatch({ type: "local-failure", code: result.code });
      return;
    }
    dispatch({ type: "local-success", image: result.image, smallWarning: result.smallWarning });
  }

  return (
    <div className="creaza-preview" data-creaza-mode="local-file-preview">
      <a className="creaza-preview__skip" href="#creaza-preview-main">
        Sari la conținut
      </a>

      <header className="creaza-preview__top">
        <a className="creaza-preview__brand" href="/studio-preview">
          kidAR
        </a>
        <p className="creaza-preview__badge">{COPY.previewBadge}</p>
      </header>

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
          <section aria-labelledby="creaza-preset-title">
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

            <div className="creaza-actions">
              <button
                type="button"
                className="creaza-cta"
                onClick={() => dispatch({ type: "continue-preset" })}
              >
                {COPY.preset.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "foto" ? (
          <section aria-labelledby="creaza-foto-title">
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
                tabIndex={0}
                aria-controls={fileInputId}
                aria-label={
                  state.fotoError
                    ? FOTO_ERROR_COPY[state.fotoError]
                    : state.localSource
                      ? COPY.foto.dropSelected
                      : COPY.foto.dropEmpty
                }
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  dispatch({ type: "foto-drag-over" });
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!state.localSource) {
                    dispatch({ type: "foto-fixture", ui: "empty" });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = pickFirstImageFile(event.dataTransfer.files);
                  void ingestFile(file);
                }}
              >
                {state.localSource && !state.fotoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="creaza-drop__preview"
                    src={state.localSource.objectUrl}
                    alt={`Preview local: ${state.localSource.name}`}
                  />
                ) : (state.fotoUi === "selected" || state.fotoUi === "loading") && !state.fotoError ? (
                  <div className="creaza-drop__paper">
                    <CreazaArt kind="paper" />
                  </div>
                ) : null}

                <p className="creaza-drop__label">
                  {state.fotoError
                    ? FOTO_ERROR_COPY[state.fotoError]
                    : state.localSource
                      ? COPY.foto.dropSelected
                      : state.fotoUi === "loading"
                        ? COPY.foto.dropLoading
                        : state.fotoUi === "drag-over"
                          ? "Lasă desenul aici"
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

            <div className="creaza-fixture-bar" role="group" aria-label="Stări fixture (opțional)">
              {(Object.keys(FOTO_FIXTURE_LABELS) as FotoFixtureState[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={!state.localSource && state.fotoUi === key ? "is-active" : undefined}
                  onClick={() => dispatch({ type: "foto-fixture", ui: key })}
                >
                  {FOTO_FIXTURE_LABELS[key]}
                </button>
              ))}
              {state.localSource ? (
                <button type="button" onClick={() => dispatch({ type: "local-clear" })}>
                  Elimină fișierul
                </button>
              ) : null}
            </div>

            <div className="creaza-actions">
              <button type="button" className="creaza-ghost" onClick={() => dispatch({ type: "back" })}>
                {COPY.foto.back}
              </button>
              <button
                type="button"
                className="creaza-cta"
                onClick={() => dispatch({ type: "continue-foto" })}
              >
                {COPY.foto.cta}
              </button>
            </div>
          </section>
        ) : null}

        {state.step === "experienta" ? (
          <section aria-labelledby="creaza-exp-title">
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
                    disabled={Boolean(soon)}
                    aria-pressed={state.experience === door.id}
                    onClick={() => {
                      if (soon) return;
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

            <div className="creaza-actions">
              <button type="button" className="creaza-ghost" onClick={() => dispatch({ type: "back" })}>
                {COPY.experienta.back}
              </button>
              <button
                type="button"
                className="creaza-cta"
                onClick={() => dispatch({ type: "continue-experience" })}
              >
                {COPY.experienta.cta}
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
                    alt={`Preview local: ${state.localSource.name}`}
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
              <a className="creaza-ghost" href="/studio-preview">
                {COPY.confirmare.atelier}
              </a>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
