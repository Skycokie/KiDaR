"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Grid3x3,
  Maximize2,
  RotateCcw,
  RotateCw,
  Route,
  SlidersHorizontal,
  X
} from "lucide-react";
import { SiteHeader } from "@/components/site-nav";
import {
  ANIMATIONS,
  CAMERA_PRESETS,
  COPY,
  DECOR_ASSETS,
  PERSONALIZE_STUDIO_HREF,
  STAGES,
  STYLE_PRESETS,
  TRANSFORM_MODES,
  type AnimationId,
  type CameraPresetId,
  type DecorId,
  type StudioStageId,
  type StylePresetId,
  type TransformModeId
} from "./fixtures";
import {
  createInitialPersonalizeState,
  frameFit,
  nudgeOrbit,
  nudgeOrbitFromScreen,
  ORBIT_PITCH_STEP,
  ORBIT_ROLL_STEP,
  ORBIT_YAW_STEP,
  setAnimation,
  setArLive,
  setCameraPreset,
  setDetails,
  setLeftOpen,
  setLight,
  setOriginalColors,
  setPreserveOutline,
  setPublishOpen,
  setRightOpen,
  setShadow,
  setShowOriginalPage,
  setAutoRotate,
  setStage,
  setStylePreset,
  setTransformMode,
  setVariantIndex,
  setVolume,
  setZoom,
  summarizePersonalize,
  toggleDecor,
  toggleGrid,
  type PersonalizeState
} from "./form-state";
import { GardenPoster } from "./garden-poster";
import {
  type PreviewProjectContext,
  type StartSaveStatus,
  buildStartTransformPatch,
  isStartPoseDirty,
  patchStartTransform,
  startSavePresentation
} from "./save-start-transform";
import "./personalize-preview.css";

type Action =
  | { type: "stage"; id: StudioStageId }
  | { type: "transform"; id: TransformModeId }
  | { type: "volume"; value: number }
  | { type: "details"; value: number }
  | { type: "outline"; value: boolean }
  | { type: "style"; id: StylePresetId }
  | { type: "colors"; value: boolean }
  | { type: "light"; value: number }
  | { type: "shadow"; value: number }
  | { type: "animation"; id: AnimationId }
  | { type: "decor"; id: DecorId }
  | { type: "camera"; id: CameraPresetId }
  | { type: "grid" }
  | { type: "frame" }
  | { type: "zoom"; value: number }
  | { type: "orbit"; yaw: number; pitch: number; roll?: number; user?: boolean }
  | { type: "page"; value: boolean }
  | { type: "autoRotate"; value: boolean }
  | { type: "variant"; index: number }
  | { type: "arLive"; value: boolean }
  | { type: "left"; open: boolean }
  | { type: "right"; open: boolean }
  | { type: "publish"; open: boolean };

function reducer(state: PersonalizeState, action: Action): PersonalizeState {
  switch (action.type) {
    case "stage":
      return setStage(state, action.id);
    case "transform":
      return setTransformMode(state, action.id);
    case "volume":
      return setVolume(state, action.value);
    case "details":
      return setDetails(state, action.value);
    case "outline":
      return setPreserveOutline(state, action.value);
    case "style":
      return setStylePreset(state, action.id);
    case "colors":
      return setOriginalColors(state, action.value);
    case "light":
      return setLight(state, action.value);
    case "shadow":
      return setShadow(state, action.value);
    case "animation":
      return setAnimation(state, action.id);
    case "decor":
      return toggleDecor(state, action.id);
    case "camera":
      return setCameraPreset(state, action.id);
    case "grid":
      return toggleGrid(state);
    case "frame":
      return frameFit(state);
    case "zoom":
      return setZoom(state, action.value);
    case "orbit":
      if (action.user) {
        return nudgeOrbitFromScreen(
          state,
          action.yaw,
          action.pitch,
          action.roll ?? 0,
          true
        );
      }
      return nudgeOrbit(state, action.yaw, action.pitch, false, action.roll ?? 0);
    case "page":
      return setShowOriginalPage(state, action.value);
    case "autoRotate":
      return setAutoRotate(state, action.value);
    case "variant":
      return setVariantIndex(state, action.index);
    case "arLive":
      return setArLive(state, action.value);
    case "left":
      return setLeftOpen(state, action.open);
    case "right":
      return setRightOpen(state, action.open);
    case "publish":
      return setPublishOpen(state, action.open);
    default:
      return state;
  }
}

function SheetChrome({
  title,
  onClose
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="studio-ws__sheet-chrome">
      <span className="studio-ws__sheet-handle" aria-hidden="true" />
      <div className="studio-ws__sheet-row">
        <p className="studio-ws__sheet-title">{title}</p>
        <button type="button" className="studio-ws__sheet-close" onClick={onClose} aria-label={COPY.closePanel}>
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function StageNav({
  state,
  onSelect
}: {
  state: PersonalizeState;
  onSelect: (id: StudioStageId) => void;
}) {
  return (
    <nav className="studio-ws__stages" aria-label={COPY.sidebarLabel}>
      <p className="studio-ws__stages-label">{COPY.pathLabel}</p>
      <ol className="studio-ws__path">
        {STAGES.map((stage, index) => {
          const active = state.stage === stage.id;
          const done = state.completedStages.includes(stage.id);
          return (
            <li key={stage.id} className="studio-ws__path-item">
              {index > 0 ? <span className="studio-ws__path-line" aria-hidden="true" /> : null}
              <button
                type="button"
                className={`studio-ws__stage${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(stage.id)}
              >
                <span className="studio-ws__stage-mark" aria-hidden="true">
                  {done && !active ? <Check size={12} strokeWidth={2.5} /> : (
                    <em>{index + 1}</em>
                  )}
                </span>
                <span className="studio-ws__stage-copy">
                  <strong>{stage.label}</strong>
                  {stage.hint ? <span>{stage.hint}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Inspector({
  state,
  dispatch,
  drawingSrc,
  projectId
}: {
  state: PersonalizeState;
  dispatch: (action: Action) => void;
  drawingSrc?: string | null;
  projectId?: string | null;
}) {
  if (state.stage === "desenul") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>Desen</h2>
        <p className="studio-ws__muted">
          {drawingSrc
            ? "Desenul salvat din Atelier e pe scenă. Continuă ca să ridici personajul din hârtie."
            : "Nu există încă o poză legată. Continuă cu fixture-ul demonstrativ sau revino din Atelier."}
        </p>
        <div className={`studio-ws__drawing-card${drawingSrc ? " has-photo" : ""}`}>
          {drawingSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drawingSrc} alt="Desenul salvat" className="studio-ws__drawing-photo" />
          ) : (
            <span className="studio-ws__drawing-paper" aria-hidden="true" />
          )}
        </div>
        <button
          type="button"
          className="studio-ws__primary-btn"
          onClick={() => dispatch({ type: "stage", id: "personajul" })}
        >
          Continuă la personaj
        </button>
      </div>
    );
  }

  if (state.stage === "personajul") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>Personaj</h2>
        <p className="studio-ws__section-label">{COPY.modeSection}</p>
        <div className="studio-ws__mode-cards" role="group" aria-label={COPY.modeSection}>
          {TRANSFORM_MODES.map((mode) => {
            const selected = state.transformMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={selected}
                className={`studio-ws__mode-card studio-ws__mode-card--${mode.id}${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "transform", id: mode.id })}
              >
                <span className="studio-ws__mode-preview" aria-hidden="true">
                  <span className="studio-ws__mode-blob" />
                </span>
                <span className="studio-ws__mode-copy">
                  <strong>{mode.label}</strong>
                  {mode.hint ? <span>{mode.hint}</span> : null}
                </span>
                {selected ? (
                  <span className="studio-ws__mode-check" aria-hidden="true">
                    <Check size={14} strokeWidth={2.4} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="studio-ws__section-label">{COPY.variantSoon}</p>
        <div className="studio-ws__variant-row" role="group" aria-label={COPY.variantSoon}>
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              type="button"
              className={state.variantIndex === index ? "is-active" : undefined}
              aria-pressed={state.variantIndex === index}
              aria-label={`Varianta ${index + 1}`}
              onClick={() => dispatch({ type: "variant", index })}
            />
          ))}
        </div>

        <label className="studio-ws__slider">
          <span>
            {COPY.volume}
            <em>{state.volume}</em>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.volume}
            onChange={(event) => dispatch({ type: "volume", value: Number(event.target.value) })}
          />
        </label>

        <label className="studio-ws__slider">
          <span>
            {COPY.details}
            <em>{state.details}</em>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.details}
            onChange={(event) => dispatch({ type: "details", value: Number(event.target.value) })}
          />
        </label>

        <label className="studio-ws__toggle">
          <input
            type="checkbox"
            checked={state.preserveOutline}
            onChange={(event) => dispatch({ type: "outline", value: event.target.checked })}
          />
          <span>{COPY.preserveOutline}</span>
        </label>

        <button type="button" className="studio-ws__ghost-btn" disabled title="În curând">
          {COPY.regenerate}
        </button>
      </div>
    );
  }

  if (state.stage === "aspect") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>{COPY.aspect}</h2>
        <p className="studio-ws__section-label">{COPY.styleSection}</p>
        <div className="studio-ws__style-cards" role="radiogroup" aria-label={COPY.styleSection}>
          {STYLE_PRESETS.map((preset) => {
            const selected = state.stylePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`studio-ws__style-card studio-ws__style-card--${preset.id}${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "style", id: preset.id })}
              >
                <span className="studio-ws__style-swatch" aria-hidden="true" />
                <strong>{preset.label}</strong>
                {preset.hint ? <span>{preset.hint}</span> : null}
              </button>
            );
          })}
        </div>

        <label className="studio-ws__toggle">
          <input
            type="checkbox"
            checked={state.originalColors}
            onChange={(event) => dispatch({ type: "colors", value: event.target.checked })}
          />
          <span>{COPY.originalColors}</span>
        </label>

        <label className="studio-ws__slider">
          <span>
            Lumină
            <em>{state.light}</em>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.light}
            onChange={(event) => dispatch({ type: "light", value: Number(event.target.value) })}
          />
        </label>

        <label className="studio-ws__slider">
          <span>
            Umbră
            <em>{state.shadow}</em>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.shadow}
            onChange={(event) => dispatch({ type: "shadow", value: Number(event.target.value) })}
          />
        </label>
      </div>
    );
  }

  if (state.stage === "miscare") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>{COPY.giveLife}</h2>
        <div className="studio-ws__motion-cards" role="radiogroup" aria-label={COPY.giveLife}>
          {ANIMATIONS.map((anim) => {
            const selected = state.animation === anim.id;
            return (
              <button
                key={anim.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`studio-ws__motion-card${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "animation", id: anim.id })}
              >
                <span
                  className={`studio-ws__motion-preview studio-ws__motion-preview--${anim.id}`}
                  aria-hidden="true"
                >
                  <span />
                </span>
                <strong>{anim.label}</strong>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (state.stage === "decor") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>{COPY.placeInWorld}</h2>
        <div className="studio-ws__assets" role="group" aria-label={COPY.placeInWorld}>
          {DECOR_ASSETS.map((asset) => {
            const selected = state.decor.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                aria-pressed={selected}
                className={`studio-ws__asset${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "decor", id: asset.id })}
              >
                <span className={`studio-ws__asset-icon studio-ws__asset-icon--${asset.id}`} aria-hidden="true" />
                <span>{asset.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="studio-ws__inspector-block">
      <h2>AR</h2>
      <p className="studio-ws__muted">{COPY.arPreviewNote}</p>
      <div className={`studio-ws__ar-card${drawingSrc ? " has-photo" : ""}${state.arLive ? " is-live" : ""}`}>
        <span className="studio-ws__ar-frame">
          {drawingSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drawingSrc} alt="Previzualizare AR" className="studio-ws__drawing-photo" />
          ) : null}
        </span>
        <span className="studio-ws__ar-caption">
          {state.arLive
            ? "Previzualizare AR activă pe scenă"
            : drawingSrc
              ? "Previzualizare AR locală"
              : "Cadru demonstrativ"}
        </span>
      </div>
      <button
        type="button"
        className="studio-ws__primary-btn"
        aria-pressed={state.arLive}
        onClick={() => dispatch({ type: "arLive", value: !state.arLive })}
      >
        {state.arLive ? "Oprește previzualizarea AR" : COPY.seeInAr}
      </button>
    </div>
  );
}

type StartSaveState = {
  status: StartSaveStatus;
  baselineYaw: number;
  baselinePitch: number;
};

type StartSaveAction =
  | { type: "saving" }
  | { type: "saved"; yaw: number; pitch: number }
  | { type: "error" };

function startSaveReducer(current: StartSaveState, action: StartSaveAction): StartSaveState {
  if (action.type === "saving") return { ...current, status: "saving" };
  if (action.type === "saved") {
    return { status: "saved", baselineYaw: action.yaw, baselinePitch: action.pitch };
  }
  return { ...current, status: "error" };
}

/**
 * Studio personalize workspace — local fixture shell + optional saved drawing from Atelier.
 * Singura scriere aprobată este PATCH-ul pentru poziția de start a modelului.
 * Fără cameră hardware, fără publicare și fără generare GLB.
 */
export function PersonalizePreviewShell({
  drawingSrc = null,
  projectContext = null
}: {
  drawingSrc?: string | null;
  projectContext?: PreviewProjectContext | null;
}) {
  const projectId = projectContext?.projectId ?? null;
  const orbitSeed = {
    yaw: projectContext?.startYaw ?? null,
    pitch: projectContext?.startPitch ?? null
  };
  const [state, dispatch] = useReducer(reducer, orbitSeed, (seed) => {
    const next = createInitialPersonalizeState();
    if (seed.yaw == null && seed.pitch == null) return next;
    return {
      ...next,
      orbitYaw: seed.yaw ?? next.orbitYaw,
      orbitPitch: seed.pitch ?? next.orbitPitch
    };
  });
  const [save, saveDispatch] = useReducer(startSaveReducer, {
    status: "idle",
    baselineYaw: orbitSeed.yaw ?? createInitialPersonalizeState().orbitYaw,
    baselinePitch: orbitSeed.pitch ?? createInitialPersonalizeState().orbitPitch
  });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const publishDialogRef = useRef<HTMLDivElement | null>(null);
  const summary = summarizePersonalize(state);
  const activeStage = STAGES.find((stage) => stage.id === state.stage);
  const hasDrawing = Boolean(drawingSrc);
  const startDirty = isStartPoseDirty(
    { yaw: state.orbitYaw, pitch: state.orbitPitch },
    { yaw: save.baselineYaw, pitch: save.baselinePitch }
  );
  const startPresentation = startSavePresentation({
    hasProject: Boolean(projectContext),
    dirty: startDirty,
    status: save.status
  });

  const onSaveStart = async () => {
    if (!projectContext || startPresentation.disabled) return;
    const yaw = state.orbitYaw;
    const pitch = state.orbitPitch;
    if (state.autoRotate) dispatch({ type: "autoRotate", value: false });
    saveDispatch({ type: "saving" });
    const ok = await patchStartTransform(
      projectContext.projectId,
      buildStartTransformPatch({
        yaw,
        pitch,
        offset: projectContext.offset,
        scale: projectContext.scale
      })
    );
    saveDispatch(ok ? { type: "saved", yaw, pitch } : { type: "error" });
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -5 : 5;
      dispatch({ type: "zoom", value: state.zoom + delta });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [state.zoom]);

  useEffect(() => {
    if (!state.autoRotate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const degPerSec = reduced ? 8 : 24;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      dispatch({ type: "orbit", yaw: degPerSec * dt, pitch: 0 });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [state.autoRotate]);

  const openAr = () => dispatch({ type: "arLive", value: true });
  const closePublish = () => dispatch({ type: "publish", open: false });

  useEffect(() => {
    if (!state.publishOpen) return;
    const dialog = publishDialogRef.current;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePublish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previously?.focus();
    };
  }, [state.publishOpen]);

  const renderPublish = () => (
    <button
      type="button"
      className="studio-ws__btn-secondary"
      disabled={!projectId}
      title={projectId ? COPY.publishPrepareTitle : "Doar previzualizare"}
      onClick={() => {
        if (!projectId) return;
        dispatch({ type: "publish", open: true });
      }}
    >
      {COPY.publish}
    </button>
  );

  return (
    <div
      className="studio-ws"
      data-studio-mode="personalize-workspace"
      data-has-drawing={hasDrawing ? "yes" : "no"}
      data-project={projectId ? "linked" : "fixture"}
      data-ar-live={state.arLive ? "yes" : "no"}
      data-sheet={state.leftOpen || state.rightOpen ? "open" : "closed"}
    >
      <a className="studio-ws__skip" href="#studio-ws-main">
        Sari la conținut
      </a>

      <SiteHeader
        brandHref={PERSONALIZE_STUDIO_HREF}
        studioHref={PERSONALIZE_STUDIO_HREF}
        trailing={
          <div className="studio-ws__header-actions">
            <span className="studio-ws__saved" aria-live="polite">
              {COPY.savedLocal}
            </span>
            {renderPublish()}
            <button type="button" className="studio-ws__btn-primary" onClick={openAr}>
              {COPY.seeInAr}
            </button>
          </div>
        }
        mobileExtra={
          <>
            <p className="studio-ws__saved studio-ws__saved--sheet">{COPY.savedLocal}</p>
            {renderPublish()}
            <button type="button" className="studio-ws__btn-primary" onClick={openAr}>
              {COPY.seeInAr}
            </button>
          </>
        }
      />

      <main id="studio-ws-main" className="studio-ws__main">
        <aside
          className={`studio-ws__left${state.leftOpen ? " is-open" : ""}`}
          aria-label={COPY.sidebarLabel}
        >
          <SheetChrome
            title={COPY.pathLabel}
            onClose={() => dispatch({ type: "left", open: false })}
          />
          <StageNav state={state} onSelect={(id) => dispatch({ type: "stage", id })} />
        </aside>

        <section className="studio-ws__center" aria-labelledby="studio-ws-title">
          <header className="studio-ws__center-head">
            <div>
              <p className="studio-ws__kicker">{COPY.brandKicker}</p>
              <h1 id="studio-ws-title" className="studio-ws__title">
                {COPY.title}
              </h1>
            </div>
            <p className="studio-ws__hint">{COPY.stageHint}</p>
          </header>

          <div
            ref={viewportRef}
            className={`studio-ws__viewport${state.arLive ? " is-ar-live" : ""}`}
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("button, input, label, a")) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
            }}
            onPointerMove={(event) => {
              if (!dragRef.current.active) return;
              const dx = event.clientX - dragRef.current.lastX;
              const dy = event.clientY - dragRef.current.lastY;
              dragRef.current.lastX = event.clientX;
              dragRef.current.lastY = event.clientY;
              dispatch({ type: "orbit", yaw: dx / 2, pitch: dy / 2, user: true });
            }}
            onPointerUp={() => {
              dragRef.current.active = false;
            }}
            onPointerLeave={() => {
              dragRef.current.active = false;
            }}
          >
            <div className="studio-ws__stage-frame">
            <GardenPoster
              state={state}
              transformMode={state.transformMode}
              drawingSrc={drawingSrc}
              showOriginalPage={state.showOriginalPage}
            />

            <div className="studio-ws__dpad-cluster">
              <div className="studio-ws__dpad" role="group" aria-label="Rotire scenă">
                <button
                  type="button"
                  className="studio-ws__dpad-btn studio-ws__dpad-btn--up"
                  aria-label={COPY.tiltUp}
                  title={COPY.tiltUp}
                  onClick={() => dispatch({ type: "orbit", yaw: 0, pitch: ORBIT_PITCH_STEP, user: true })}
                >
                  <ArrowUp size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="studio-ws__dpad-btn studio-ws__dpad-btn--left"
                  aria-label={COPY.rotateLeft}
                  title={COPY.rotateLeft}
                  onClick={() => dispatch({ type: "orbit", yaw: -ORBIT_YAW_STEP, pitch: 0, user: true })}
                >
                  <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="studio-ws__dpad-btn studio-ws__dpad-btn--center"
                  aria-label={COPY.resetView}
                  title={COPY.resetView}
                  onClick={() => dispatch({ type: "camera", id: "reset" })}
                >
                  <span aria-hidden>⊙</span>
                </button>
                <button
                  type="button"
                  className="studio-ws__dpad-btn studio-ws__dpad-btn--right"
                  aria-label={COPY.rotateRight}
                  title={COPY.rotateRight}
                  onClick={() => dispatch({ type: "orbit", yaw: ORBIT_YAW_STEP, pitch: 0, user: true })}
                >
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="studio-ws__dpad-btn studio-ws__dpad-btn--down"
                  aria-label={COPY.tiltDown}
                  title={COPY.tiltDown}
                  onClick={() => dispatch({ type: "orbit", yaw: 0, pitch: -ORBIT_PITCH_STEP, user: true })}
                >
                  <ArrowDown size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <div className="studio-ws__roll" role="group" aria-label={COPY.rollGroup}>
                <button
                  type="button"
                  className="studio-ws__roll-btn"
                  aria-label={COPY.rollCcw}
                  title={COPY.rollCcw}
                  onClick={() =>
                    dispatch({ type: "orbit", yaw: 0, pitch: 0, roll: -ORBIT_ROLL_STEP, user: true })
                  }
                >
                  <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="studio-ws__roll-btn"
                  aria-label={COPY.rollCw}
                  title={COPY.rollCw}
                  onClick={() =>
                    dispatch({ type: "orbit", yaw: 0, pitch: 0, roll: ORBIT_ROLL_STEP, user: true })
                  }
                >
                  <RotateCw size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className={`studio-ws__spin${state.autoRotate ? " is-active" : ""}`}
                aria-label={COPY.autoRotate}
                aria-pressed={state.autoRotate}
                title={COPY.autoRotate}
                onClick={() => dispatch({ type: "autoRotate", value: !state.autoRotate })}
              >
                <RotateCw size={16} strokeWidth={1.75} aria-hidden />
                <span>{state.autoRotate ? COPY.autoRotateStop : COPY.autoRotateOff}</span>
                {state.autoRotate ? <em>{COPY.autoRotateActive}</em> : null}
              </button>
            </div>
            <div className="studio-ws__start-save">
              <button
                type="button"
                className="studio-ws__start-save-btn"
                disabled={startPresentation.disabled}
                onClick={() => void onSaveStart()}
              >
                {startPresentation.label}
              </button>
              {startPresentation.hint ? (
                <p className="studio-ws__start-save-hint">{startPresentation.hint}</p>
              ) : null}
            </div>

            {hasDrawing && state.transformMode === "popout" ? (
              <label className="studio-ws__page-toggle studio-ws__page-toggle--float">
                <input
                  type="checkbox"
                  checked={state.showOriginalPage}
                  onChange={(event) => dispatch({ type: "page", value: event.target.checked })}
                />
                <span>{COPY.showOriginalPage}</span>
              </label>
            ) : null}
            </div>

            {state.arLive ? (
              <div className="studio-ws__ar-live" aria-live="polite">
                <div className="studio-ws__ar-live-phone">
                  <div className="studio-ws__ar-live-screen">
                    {drawingSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={drawingSrc} alt="" className="studio-ws__ar-live-photo" />
                    ) : (
                      <span className="studio-ws__ar-live-fixture" aria-hidden="true" />
                    )}
                    <p>Previzualizare AR locală</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="studio-ws__ar-live-close"
                  onClick={() => dispatch({ type: "arLive", value: false })}
                >
                  Închide AR
                </button>
              </div>
            ) : null}

            <div className="studio-ws__viewport-overlay">
              <p className="studio-ws__viewport-step">{activeStage?.label}</p>
            </div>

            <div className="studio-ws__viewport-bar">
              <div className="studio-ws__cam-presets" role="group" aria-label="Cameră">
                {CAMERA_PRESETS.map((preset) => {
                  const active =
                    preset.id === "reset"
                      ? false
                      : state.cameraPreset === preset.id ||
                        (state.cameraPreset === "reset" && preset.id === "threequarter");
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`studio-ws__cam-btn${active ? " is-active" : ""}`}
                      onClick={() => dispatch({ type: "camera", id: preset.id })}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="studio-ws__viewport-tools">
                <button
                  type="button"
                  className={`studio-ws__tool${state.gridOn ? " is-active" : ""}`}
                  aria-pressed={state.gridOn}
                  onClick={() => dispatch({ type: "grid" })}
                >
                  <Grid3x3 size={15} strokeWidth={1.75} aria-hidden />
                  <span>{COPY.grid}</span>
                </button>
                <button type="button" className="studio-ws__tool" onClick={() => dispatch({ type: "frame" })}>
                  <Maximize2 size={15} strokeWidth={1.75} aria-hidden />
                  <span>{COPY.frame}</span>
                </button>
                <label className="studio-ws__zoom">
                  <span>
                    {COPY.zoom} {state.zoom}%
                  </span>
                  <input
                    type="range"
                    min={60}
                    max={160}
                    value={state.zoom}
                    onChange={(event) => dispatch({ type: "zoom", value: Number(event.target.value) })}
                  />
                </label>
              </div>
            </div>
          </div>

          <p className="studio-ws__summary" aria-live="polite">
            {summary}
          </p>
        </section>

        <aside
          className={`studio-ws__right${state.rightOpen ? " is-open" : ""}`}
          aria-label={COPY.rightNavOpen}
        >
          <SheetChrome
            title={activeStage?.label ?? COPY.rightNavOpen}
            onClose={() => dispatch({ type: "right", open: false })}
          />
          <Inspector
            state={state}
            dispatch={dispatch}
            drawingSrc={drawingSrc}
            projectId={projectId}
          />
        </aside>
      </main>

      <nav className="studio-ws__dock" aria-label="Controale mobile">
        <button
          type="button"
          className={`studio-ws__dock-btn${state.leftOpen ? " is-active" : ""}`}
          aria-expanded={state.leftOpen}
          onClick={() => dispatch({ type: "left", open: !state.leftOpen })}
        >
          <Route size={17} strokeWidth={1.75} aria-hidden />
          {COPY.leftNavOpen}
        </button>
        <button
          type="button"
          className={`studio-ws__dock-btn${state.rightOpen ? " is-active" : ""}`}
          aria-expanded={state.rightOpen}
          onClick={() => dispatch({ type: "right", open: !state.rightOpen })}
        >
          <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden />
          {COPY.rightNavOpen}
        </button>
        <button type="button" className="studio-ws__dock-cta" onClick={openAr}>
          {COPY.seeInAr}
        </button>
      </nav>

      {state.leftOpen || state.rightOpen ? (
        <button
          type="button"
          className="studio-ws__scrim"
          aria-label={COPY.closePanel}
          onClick={() => {
            dispatch({ type: "left", open: false });
            dispatch({ type: "right", open: false });
          }}
        />
      ) : null}

      {projectId && state.publishOpen ? (
        <div
          className="studio-ws__publish-scrim"
          onClick={closePublish}
        >
          <div
            ref={publishDialogRef}
            className="studio-ws__publish-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-publish-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") closePublish();
            }}
          >
            <h2 id="studio-publish-title" className="studio-ws__publish-title">
              {COPY.publishPrepareTitle}
            </h2>
            <p>{COPY.publishLinkNote}</p>
            <p>{COPY.publishStartNote}</p>
            <p>{COPY.publishLaterNote}</p>
            <figure className="studio-ws__publish-qr">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <rect x="4" y="4" width="18" height="18" />
                <rect x="42" y="4" width="18" height="18" />
                <rect x="4" y="42" width="18" height="18" />
                <rect x="28" y="28" width="8" height="8" />
                <rect x="40" y="40" width="6" height="6" />
                <rect x="50" y="28" width="8" height="8" />
                <rect x="28" y="48" width="8" height="8" />
              </svg>
              <figcaption>{COPY.publishQrLabel}</figcaption>
            </figure>
            <div className="studio-ws__publish-actions">
              <button type="button" className="studio-ws__btn-primary" disabled>
                {COPY.publishWorld}
              </button>
              <p className="studio-ws__publish-inactive">{COPY.publishInactive}</p>
              <button type="button" className="studio-ws__btn-secondary" onClick={closePublish}>
                {COPY.publishBack}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
