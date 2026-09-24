"use client";

import { useEffect, useReducer, useRef, type PointerEvent as ReactPointerEvent } from "react";
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
  LIGHTINGS,
  PALETTES,
  PERSONALIZE_STUDIO_HREF,
  STAGES,
  STYLE_PRESETS,
  TRANSFORM_MODES,
  type AnimationId,
  type CameraPresetId,
  type DecorId,
  type LightingId,
  type PaletteId,
  type StudioStageId,
  type StylePresetId,
  type TransformModeId
} from "./fixtures";
import {
  applyIdeaPrompt,
  createInitialPersonalizeState,
  createWorkspaceState,
  frameFit,
  nudgeOrbit,
  nudgeOrbitFromScreen,
  orbitDeltaFromPointer,
  ORBIT_PITCH_STEP,
  ORBIT_ROLL_STEP,
  ORBIT_YAW_STEP,
  regenerateVariant,
  resetIdeaPrompt,
  setAnimation,
  setArLive,
  setCameraPreset,
  setDecorSelection,
  setDetails,
  setIdeaPrompt,
  setLeftOpen,
  setLighting,
  setLight,
  setOriginalColors,
  setPalette,
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
  zoomFromPinch,
  zoomFromWheel,
  toggleGrid,
  type PersonalizeState
} from "./form-state";
import { IdeaPromptCard } from "./idea-prompt-card";
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

function pointerSpan(points: Map<number, { x: number; y: number }>): number {
  const pts = [...points.values()];
  if (pts.length < 2) return 0;
  return Math.hypot((pts[0]?.x ?? 0) - (pts[1]?.x ?? 0), (pts[0]?.y ?? 0) - (pts[1]?.y ?? 0));
}

type Action =
  | { type: "stage"; id: StudioStageId }
  | { type: "transform"; id: TransformModeId }
  | { type: "volume"; value: number }
  | { type: "details"; value: number }
  | { type: "outline"; value: boolean }
  | { type: "style"; id: StylePresetId }
  | { type: "palette"; id: PaletteId }
  | { type: "lighting"; id: LightingId }
  | { type: "colors"; value: boolean }
  | { type: "light"; value: number }
  | { type: "shadow"; value: number }
  | { type: "animation"; id: AnimationId }
  | { type: "decor"; id: DecorId | "none" }
  | { type: "idea"; value: string }
  | { type: "applyIdea" }
  | { type: "resetIdea" }
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
    case "palette":
      return setPalette(state, action.id);
    case "lighting":
      return setLighting(state, action.id);
    case "colors":
      return setOriginalColors(state, action.value);
    case "light":
      return setLight(state, action.value);
    case "shadow":
      return setShadow(state, action.value);
    case "animation":
      return setAnimation(state, action.id);
    case "decor":
      return setDecorSelection(state, action.id);
    case "idea":
      return setIdeaPrompt(state, action.value);
    case "applyIdea":
      return applyIdeaPrompt(state, state.ideaPrompt);
    case "resetIdea":
      return resetIdeaPrompt(state);
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
      return action.index < 0 ? regenerateVariant(state) : setVariantIndex(state, action.index);
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
  hasDrawing,
  onSelect
}: {
  state: PersonalizeState;
  hasDrawing: boolean;
  onSelect: (id: StudioStageId) => void;
}) {
  return (
    <nav className="studio-ws__stages" aria-label={COPY.sidebarLabel}>
      <p className="studio-ws__stages-label">{COPY.pathLabel}</p>
      <ol className="studio-ws__path">
        {STAGES.map((stage, index) => {
          const active = state.stage === stage.id;
          const done = state.completedStages.includes(stage.id);
          const locked = !hasDrawing && stage.id !== "desenul";
          return (
            <li key={stage.id} className="studio-ws__path-item">
              {index > 0 ? <span className="studio-ws__path-line" aria-hidden="true" /> : null}
              <button
                type="button"
                className={`studio-ws__stage${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                aria-current={active ? "step" : undefined}
                disabled={locked}
                title={locked ? COPY.stepLocked : undefined}
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

function ideaCard(state: PersonalizeState, dispatch: (action: Action) => void, locked: boolean) {
  return (
    <IdeaPromptCard
      state={state}
      locked={locked}
      onChange={(value) => dispatch({ type: "idea", value })}
      onApply={() => dispatch({ type: "applyIdea" })}
      onReset={() => dispatch({ type: "resetIdea" })}
    />
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
  const hasDrawing = Boolean(drawingSrc);
  const showIdea =
    state.stage === "personajul" ||
    state.stage === "aspect" ||
    state.stage === "miscare" ||
    state.stage === "decor";
  if (state.stage === "desenul") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>Desen</h2>
        <p className="studio-ws__muted">{hasDrawing ? COPY.drawingReady : COPY.emptyDrawing}</p>
        {hasDrawing ? null : ideaCard(state, dispatch, true)}
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
          disabled={!hasDrawing}
          title={hasDrawing ? undefined : COPY.stepLocked}
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
        {showIdea ? ideaCard(state, dispatch, !hasDrawing) : null}
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
        {state.transformMode === "figurine" ? (
          <p className="studio-ws__muted">{COPY.figurineDemo}</p>
        ) : null}

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

        <button
          type="button"
          className="studio-ws__ghost-btn"
          onClick={() => dispatch({ type: "variant", index: -1 })}
        >
          {COPY.regenerate}
        </button>
      </div>
    );
  }

  if (state.stage === "aspect") {
    return (
      <div className="studio-ws__inspector-block">
        {ideaCard(state, dispatch, !hasDrawing)}
        <h2>{COPY.aspect}</h2>
        <p className="studio-ws__section-label">{COPY.paletteSection}</p>
        <div className="studio-ws__choice-row" role="radiogroup" aria-label={COPY.paletteSection}>
          {PALETTES.map((palette) => {
            const selected = state.palette === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`studio-ws__choice${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "palette", id: palette.id })}
              >
                <span className={`studio-ws__choice-mark studio-ws__choice-mark--${palette.id}`} aria-hidden="true" />
                {palette.label}
              </button>
            );
          })}
        </div>
        <p className="studio-ws__section-label">{COPY.lightingSection}</p>
        <div className="studio-ws__choice-row" role="radiogroup" aria-label={COPY.lightingSection}>
          {LIGHTINGS.map((lighting) => {
            const selected = state.lighting === lighting.id;
            return (
              <button
                key={lighting.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`studio-ws__choice${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "lighting", id: lighting.id })}
              >
                <span className={`studio-ws__choice-mark studio-ws__choice-mark--${lighting.id}`} aria-hidden="true" />
                {lighting.label}
              </button>
            );
          })}
        </div>
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
        {ideaCard(state, dispatch, !hasDrawing)}
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
    const noneSelected = state.decor.length === 0;
    return (
      <div className="studio-ws__inspector-block">
        {ideaCard(state, dispatch, !hasDrawing)}
        <h2>{COPY.placeInWorld}</h2>
        <div className="studio-ws__assets" role="radiogroup" aria-label={COPY.placeInWorld}>
          <button
            type="button"
            role="radio"
            aria-checked={noneSelected}
            className={`studio-ws__asset${noneSelected ? " is-selected" : ""}`}
            onClick={() => dispatch({ type: "decor", id: "none" })}
          >
            <span className="studio-ws__asset-icon studio-ws__asset-icon--none" aria-hidden="true" />
            <span>{COPY.noDecor}</span>
          </button>
          {DECOR_ASSETS.map((asset) => {
            const selected = state.decor[0] === asset.id;
            return (
              <button
                key={asset.id}
                type="button"
                role="radio"
                aria-checked={selected}
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
      <div className="studio-ws__ar-card">
        <span className="studio-ws__ar-frame" aria-hidden="true" />
        <span className="studio-ws__ar-caption">
          {drawingSrc ? COPY.arCardCaption : COPY.arCardEmpty}
        </span>
      </div>
      <button type="button" className="studio-ws__primary-btn" disabled title={COPY.seeInArPreparing}>
        {COPY.seeInArPreparing}
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
    hasDrawing: Boolean(drawingSrc),
    yaw: projectContext?.startYaw ?? null,
    pitch: projectContext?.startPitch ?? null
  };
  const [state, dispatch] = useReducer(reducer, createWorkspaceState(orbitSeed));
  const [save, saveDispatch] = useReducer(startSaveReducer, {
    status: "idle",
    baselineYaw: orbitSeed.yaw ?? createInitialPersonalizeState().orbitYaw,
    baselinePitch: orbitSeed.pitch ?? createInitialPersonalizeState().orbitPitch
  });
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastY: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(state.zoom);
  zoomRef.current = state.zoom;
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
      const next = zoomFromWheel(zoomRef.current, event.deltaY);
      if (next !== zoomRef.current) dispatch({ type: "zoom", value: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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

  const markDragging = (active: boolean) => {
    const el = viewportRef.current;
    if (!el) return;
    if (active) el.dataset.dragging = "yes";
    else delete el.dataset.dragging;
  };

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, label, a")) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    markDragging(true);
    if (state.autoRotate) dispatch({ type: "autoRotate", value: false });
    if (pointersRef.current.size >= 2) {
      dragRef.current.active = false;
      pinchRef.current = { distance: pointerSpan(pointersRef.current) };
      return;
    }
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    };
  };

  const onViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      event.preventDefault();
      const nextDistance = pointerSpan(pointersRef.current);
      const nextZoom = zoomFromPinch(zoomRef.current, pinchRef.current.distance, nextDistance);
      pinchRef.current.distance = nextDistance;
      if (nextZoom !== zoomRef.current) dispatch({ type: "zoom", value: nextZoom });
      return;
    }
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.lastX;
    const dy = event.clientY - dragRef.current.lastY;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    if (dx === 0 && dy === 0) return;
    const delta = orbitDeltaFromPointer(dx, dy);
    dispatch({ type: "orbit", yaw: delta.yaw, pitch: delta.pitch, user: true });
  };

  const onViewportPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size >= 2) {
      pinchRef.current = { distance: pointerSpan(pointersRef.current) };
      dragRef.current.active = false;
      return;
    }
    pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.entries()][0];
      if (!remaining) return;
      const [id, point] = remaining;
      dragRef.current = { active: true, pointerId: id, lastX: point.x, lastY: point.y };
      return;
    }
    dragRef.current.active = false;
    markDragging(false);
  };

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

  const renderViewControls = (variant: "overlay" | "sheet") => (
    <>
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
            onClick={() => dispatch({ type: "orbit", yaw: 0, pitch: 0, roll: -ORBIT_ROLL_STEP, user: true })}
          >
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            className="studio-ws__roll-btn"
            aria-label={COPY.rollCw}
            title={COPY.rollCw}
            onClick={() => dispatch({ type: "orbit", yaw: 0, pitch: 0, roll: ORBIT_ROLL_STEP, user: true })}
          >
            <RotateCw size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {variant === "overlay" ? (
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
        ) : null}
      </div>
      {hasDrawing && state.transformMode === "popout" ? (
        <label
          className={
            variant === "overlay"
              ? "studio-ws__page-toggle studio-ws__page-toggle--float"
              : "studio-ws__page-toggle"
          }
        >
          <input
            type="checkbox"
            checked={state.showOriginalPage}
            onChange={(event) => dispatch({ type: "page", value: event.target.checked })}
          />
          <span>{COPY.showOriginalPage}</span>
        </label>
      ) : null}
      {variant === "sheet" ? (
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
      ) : null}
    </>
  );

  return (
    <div
      className="studio-ws"
      data-studio-mode="personalize-workspace"
      data-has-drawing={hasDrawing ? "yes" : "no"}
      data-project={projectId ? "linked" : "fixture"}
      data-ar-live="no"
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
            <button type="button" className="studio-ws__btn-primary" disabled title={COPY.seeInArPreparing}>
              {COPY.seeInArPreparing}
            </button>
          </div>
        }
        mobileExtra={
          <>
            <p className="studio-ws__saved studio-ws__saved--sheet">{COPY.savedLocal}</p>
            {renderPublish()}
            <button type="button" className="studio-ws__btn-primary" disabled title={COPY.seeInArPreparing}>
              {COPY.seeInArPreparing}
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
          <StageNav
            state={state}
            hasDrawing={hasDrawing}
            onSelect={(id) => dispatch({ type: "stage", id })}
          />
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
            className="studio-ws__viewport"
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={onViewportPointerEnd}
            onPointerCancel={onViewportPointerEnd}
          >
            <div className="studio-ws__stage-frame">
            <GardenPoster
              state={state}
              transformMode={state.transformMode}
              drawingSrc={drawingSrc}
              showOriginalPage={state.showOriginalPage}
            />

            <div className="studio-ws__overlay-tools">{renderViewControls("overlay")}</div>
            <button
              type="button"
              className={`studio-ws__spin studio-ws__spin--float${state.autoRotate ? " is-active" : ""}`}
              aria-label={COPY.autoRotate}
              aria-pressed={state.autoRotate}
              title={COPY.autoRotate}
              onClick={() => dispatch({ type: "autoRotate", value: !state.autoRotate })}
            >
              <RotateCw size={16} strokeWidth={1.75} aria-hidden />
              <span>360°</span>
            </button>
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

            </div>

            <div className="studio-ws__viewport-overlay">
              <p className="studio-ws__viewport-step">{activeStage?.label}</p>
            </div>

            <div className="studio-ws__overlay-tools">
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
          <div className="studio-ws__view-controls studio-ws__view-controls--sheet">
            {renderViewControls("sheet")}
          </div>
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
        <button type="button" className="studio-ws__dock-cta" disabled title={COPY.seeInArPreparing}>
          {COPY.seeInArPreparing}
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
