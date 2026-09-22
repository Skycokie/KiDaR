"use client";

import Link from "next/link";
import { useReducer } from "react";
import {
  ATMOSPHERES,
  CHARACTERS,
  COMING_SOON_CONTROL,
  COPY,
  EFFECTS,
  FIXTURE_WORLD,
  PERSONALIZE_BACK_HREF,
  PERSONALIZE_CAMERA_HREF,
  POSITIONS,
  SCALES,
  SOUNDS,
  type AtmosphereId,
  type CharacterId,
  type EffectId,
  type PositionId,
  type ScaleId,
  type SoundId
} from "./fixtures";
import {
  createInitialPersonalizeState,
  setAtmosphere,
  setCharacter,
  setEffect,
  setPosition,
  setScale,
  setShowInWorld,
  setSound,
  summarizePersonalize,
  type PersonalizeState
} from "./form-state";
import { GardenPoster } from "./garden-poster";
import "./personalize-preview.css";

type Action =
  | { type: "character"; id: CharacterId }
  | { type: "effect"; id: EffectId }
  | { type: "atmosphere"; id: AtmosphereId }
  | { type: "sound"; id: SoundId }
  | { type: "position"; id: PositionId }
  | { type: "scale"; id: ScaleId }
  | { type: "toggle"; value: boolean };

function reducer(state: PersonalizeState, action: Action): PersonalizeState {
  switch (action.type) {
    case "character":
      return setCharacter(state, action.id);
    case "effect":
      return setEffect(state, action.id);
    case "atmosphere":
      return setAtmosphere(state, action.id);
    case "sound":
      return setSound(state, action.id);
    case "position":
      return setPosition(state, action.id);
    case "scale":
      return setScale(state, action.id);
    case "toggle":
      return setShowInWorld(state, action.value);
    default:
      return state;
  }
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange
}: {
  legend: string;
  name: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <fieldset className="pers-group">
      <legend>{legend}</legend>
      <div className="pers-chips" role="radiogroup" aria-label={legend}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`pers-chip${selected ? " is-selected" : ""}`}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Studio Preview Go B — local fixture personalize shell.
 * Zero network, zero persistence, zero camera.
 */
export function PersonalizePreviewShell() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialPersonalizeState);
  const summary = summarizePersonalize(state);

  return (
    <div className="pers-preview" data-studio-mode="personalize-go-b">
      <a className="pers-preview__skip" href="#pers-main">
        Sari la conținut
      </a>

      <header className="pers-preview__top">
        <Link className="pers-preview__brand" href={PERSONALIZE_BACK_HREF}>
          kidAR
        </Link>
        <p className="pers-preview__badge">{FIXTURE_WORLD.status}</p>
      </header>

      <main id="pers-main" className="pers-preview__main">
        <div className="pers-layout">
          <section className="pers-stage" aria-labelledby="pers-title">
            <p className="pers-kicker">{COPY.brandKicker}</p>
            <h1 id="pers-title" className="pers-title">
              {COPY.title}
            </h1>
            <p className="pers-lead">{COPY.lead}</p>
            <p className="pers-note">{COPY.previewNote}</p>

            <div className="pers-world-meta">
              <h2 className="pers-world-title">{FIXTURE_WORLD.title}</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{FIXTURE_WORLD.status}</dd>
                </div>
                <div>
                  <dt>Mod</dt>
                  <dd>{FIXTURE_WORLD.mode}</dd>
                </div>
              </dl>
            </div>

            <GardenPoster state={state} />

            <p className="pers-summary" aria-live="polite">
              <span className="pers-summary__label">{COPY.summaryLabel}</span>
              {summary}
            </p>
          </section>

          <aside className="pers-panel" aria-label={COPY.panelTitle}>
            <h2 className="pers-panel__title">{COPY.panelTitle}</h2>

            <ChoiceGroup
              legend="Personaj"
              name="character"
              options={CHARACTERS}
              value={state.character}
              onChange={(id) => dispatch({ type: "character", id })}
            />
            <ChoiceGroup
              legend="Efect"
              name="effect"
              options={EFFECTS}
              value={state.effect}
              onChange={(id) => dispatch({ type: "effect", id })}
            />
            <ChoiceGroup
              legend="Atmosferă"
              name="atmosphere"
              options={ATMOSPHERES}
              value={state.atmosphere}
              onChange={(id) => dispatch({ type: "atmosphere", id })}
            />
            <ChoiceGroup
              legend="Sunet"
              name="sound"
              options={SOUNDS}
              value={state.sound}
              onChange={(id) => dispatch({ type: "sound", id })}
            />
            <ChoiceGroup
              legend="Poziție"
              name="position"
              options={POSITIONS}
              value={state.position}
              onChange={(id) => dispatch({ type: "position", id })}
            />
            <ChoiceGroup
              legend="Scară"
              name="scale"
              options={SCALES}
              value={state.scale}
              onChange={(id) => dispatch({ type: "scale", id })}
            />

            <label className="pers-toggle">
              <input
                type="checkbox"
                checked={state.showInWorld}
                onChange={(event) => dispatch({ type: "toggle", value: event.target.checked })}
              />
              <span>{COPY.showInWorld}</span>
            </label>

            <div className="pers-group">
              <p className="pers-group__label">Alte elemente</p>
              <button type="button" className="pers-chip is-soon" disabled>
                {COMING_SOON_CONTROL.label}
                <em>{COPY.comingSoon}</em>
              </button>
            </div>

            <div className="pers-actions">
              <Link className="pers-ghost" href={PERSONALIZE_BACK_HREF}>
                {COPY.ctaBack}
              </Link>
              <Link className="pers-cta" href={PERSONALIZE_CAMERA_HREF}>
                {COPY.ctaCamera}
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
