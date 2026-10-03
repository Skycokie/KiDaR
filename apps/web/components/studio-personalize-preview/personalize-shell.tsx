"use client";

import { useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Check,
  Grid3x3,
  Maximize2,
  RotateCw,
  Route,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { SiteHeader } from "@/components/site-nav";
import { decorGlbAvailable } from "./decor-assets";
import { DecorPreviewIcon } from "./decor-preview-icons";
import { ModePreviewIcon } from "./mode-preview-icons";
import {
  ANIMATIONS,
  CAMERA_PRESETS,
  DECOR_ASSETS,
  PERSONALIZE_BACK_HREF,
  STAGE_MESSAGE_KEY,
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
  regenerateVariant,
  resetIdeaPrompt,
  setAnimation,
  setArLive,
  setCameraPreset,
  setDecorSelection,
  removeDecorInstance,
  moveDecorInstance,
  orbitDecorInstance,
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
import type { PromptLanguage } from "./idea-prompt";
import { FigurineGenerateCard } from "./figurine-generate-card";
import { UploadModelCard } from "./upload-model-card";
import { VoiceCard, type VoiceDraft } from "./voice-card";
import {
  readCharacterVoiceStatus,
  type VoiceStatusView
} from "./character-voice-client";
import { PRIMARY_CHARACTER_ID } from "@kidar/core";
import { contextPreviewLines } from "./scene-context";
import {
  evaluateFutureSceneEligibility,
  sceneSummary,
  toStudioSceneDraft,
  type FutureSceneEligibility
} from "./scene-draft";
import {
  readPublishStatus,
  shouldPollPublish,
  startPublish,
  type PublishStatusResponse
} from "./publish-world";
import { GardenPoster } from "./garden-poster";
import {
  createInteractionState,
  reduceInteraction
} from "./interaction-state";
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
  | { type: "decorRemove"; key: string }
  | { type: "decorMove"; key: string; x: number; y: number }
  | { type: "decorOrbit"; key: string; yaw: number; pitch: number }
  | { type: "idea"; value: string }
  | { type: "applyIdea"; locale?: PromptLanguage }
  | { type: "resetIdea" }
  | { type: "camera"; id: CameraPresetId }
  | { type: "grid" }
  | { type: "frame" }
  | { type: "zoom"; value: number }
  | { type: "orbit"; yaw: number; pitch: number; roll?: number; user?: boolean }
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
    case "decorRemove":
      return removeDecorInstance(state, action.key);
    case "decorMove":
      return moveDecorInstance(state, action.key, action.x, action.y);
    case "decorOrbit":
      return orbitDecorInstance(state, action.key, action.yaw, action.pitch);
    case "idea":
      return setIdeaPrompt(state, action.value);
    case "applyIdea":
      return applyIdeaPrompt(state, state.ideaPrompt, action.locale ?? "ro");
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
  closeLabel,
  onClose
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="studio-ws__sheet-chrome">
      <span className="studio-ws__sheet-handle" aria-hidden="true" />
      <div className="studio-ws__sheet-row">
        <p className="studio-ws__sheet-title">{title}</p>
        <button type="button" className="studio-ws__sheet-close" onClick={onClose} aria-label={closeLabel}>
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
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;
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
                  <strong>{messages.studio.steps[STAGE_MESSAGE_KEY[stage.id]]}</strong>
                  <span>{messages.studio.stepHints[STAGE_MESSAGE_KEY[stage.id]]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ideaCard(
  state: PersonalizeState,
  dispatch: (action: Action) => void,
  locked: boolean,
  locale: PromptLanguage
) {
  return (
    <IdeaPromptCard
      state={state}
      locked={locked}
      onChange={(value) => dispatch({ type: "idea", value })}
      onApply={() => dispatch({ type: "applyIdea", locale })}
      onReset={() => dispatch({ type: "resetIdea" })}
    />
  );
}

function Inspector({
  state,
  dispatch,
  drawingSrc,
  projectId,
  sceneEligibility,
  arExperienceUrl,
  onOpenAr,
  onVoiceChange,
  onVoiceDraftChange,
  onPlayVoice
}: {
  state: PersonalizeState;
  dispatch: (action: Action) => void;
  drawingSrc?: string | null;
  projectId?: string | null;
  sceneEligibility: FutureSceneEligibility;
  arExperienceUrl: string | null;
  onOpenAr: () => void;
  onVoiceChange?: (status: VoiceStatusView | null) => void;
  onVoiceDraftChange?: (draft: VoiceDraft | null) => void;
  onPlayVoice: (url: string) => void;
}) {
  const { locale, messages } = useStudioI18n();
  const COPY = messages.personalize;
  const hasDrawing = Boolean(drawingSrc);
  const showIdea = state.stage === "personajul";
  if (state.stage === "desenul") {
    return (
      <div className="studio-ws__inspector-block">
        <h2>{messages.studio.steps.drawing}</h2>
        <p className="studio-ws__muted">{hasDrawing ? COPY.drawingReady : COPY.emptyDrawing}</p>
        {hasDrawing ? null : ideaCard(state, dispatch, true, locale)}
        <div className={`studio-ws__drawing-card${drawingSrc ? " has-photo" : ""}`}>
          {drawingSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drawingSrc} alt={COPY.drawingAlt} className="studio-ws__drawing-photo" />
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
          {COPY.continueToCharacter}
        </button>
      </div>
    );
  }

  if (state.stage === "personajul") {
    return (
      <div className="studio-ws__inspector-block">
        {showIdea ? ideaCard(state, dispatch, !hasDrawing, locale) : null}
        <h2>{messages.studio.steps.character}</h2>
        <p className="studio-ws__section-label">{COPY.modeSection}</p>
        <div className="studio-ws__mode-cards" role="group" aria-label={COPY.modeSection}>
          {TRANSFORM_MODES.map((mode) => {
            const selected = state.transformMode === mode.id;
            const copy = COPY.choices.modes[mode.id];
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={selected}
                className={`studio-ws__mode-card studio-ws__mode-card--${mode.id}${selected ? " is-selected" : ""}`}
                onClick={() => dispatch({ type: "transform", id: mode.id })}
              >
                <span className="studio-ws__mode-preview" aria-hidden="true">
                  <ModePreviewIcon mode={mode.id} />
                </span>
                <span className="studio-ws__mode-copy">
                  <strong>{copy.label}</strong>
                  {copy.hint ? <span>{copy.hint}</span> : null}
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
          <FigurineGenerateCard projectId={projectId} hasDrawing={hasDrawing} />
        ) : null}
        {state.transformMode === "upload" ? <UploadModelCard projectId={projectId} /> : null}

        <p className="studio-ws__section-label">{COPY.giveLife}</p>
        <div className="studio-ws__assets" role="group" aria-label={COPY.giveLife}>
          {ANIMATIONS.map((anim) => {
            const selected = state.animation === anim.id;
            const copy = COPY.choices.animations[anim.id];
            return (
              <button
                key={anim.id}
                type="button"
                className={`studio-ws__asset${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                title={"hint" in copy ? copy.hint : copy.label}
                onClick={() => dispatch({ type: "animation", id: anim.id })}
              >
                <span className={`studio-ws__asset-icon studio-ws__asset-icon--${anim.id}`} aria-hidden="true" />
                <span>{copy.label}</span>
              </button>
            );
          })}
        </div>

        <p className="studio-ws__section-label">{COPY.variantSoon}</p>
        <div className="studio-ws__variant-row" role="group" aria-label={COPY.variantSoon}>
          {STYLE_PRESETS.map((preset, index) => {
            const selected = state.variantIndex === index;
            const copy = COPY.choices.styles[preset.id];
            return (
              <button
                key={preset.id}
                type="button"
                className={`studio-ws__variant studio-ws__variant--${preset.id}${selected ? " is-active" : ""}`}
                aria-pressed={selected}
                aria-label={copy.label}
                title={copy.hint ?? copy.label}
                onClick={() => dispatch({ type: "variant", index })}
              >
                <span className="studio-ws__variant-swatch" aria-hidden="true">
                  {drawingSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={drawingSrc} alt="" className="studio-ws__variant-photo" />
                  ) : (
                    <span className="studio-ws__variant-fallback" />
                  )}
                </span>
                <span className="studio-ws__variant-label">{copy.label}</span>
              </button>
            );
          })}
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

  if (state.stage === "decor") {
    const noneSelected = state.decor.length === 0;
    return (
      <div className="studio-ws__inspector-block">
        <h2>{COPY.placeInWorld}</h2>
        <p className="studio-ws__muted">{COPY.decorHint}</p>
        <div className="studio-ws__assets" role="group" aria-label={COPY.placeInWorld}>
          <button
            type="button"
            className={`studio-ws__asset${noneSelected ? " is-selected" : ""}`}
            onClick={() => dispatch({ type: "decor", id: "none" })}
          >
            <span className="studio-ws__asset-icon studio-ws__asset-icon--none" aria-hidden="true" />
            <span>{COPY.noDecor}</span>
          </button>
          {DECOR_ASSETS.map((asset) => {
            const count = state.decor.filter((item) => item.id === asset.id).length;
            const label = COPY.choices.decor[asset.id].label;
            const glbReady = decorGlbAvailable(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                className={`studio-ws__asset${count > 0 ? " is-selected" : ""}`}
                disabled={!glbReady}
                onClick={() => {
                  if (!glbReady) return;
                  dispatch({ type: "decor", id: asset.id });
                }}
                aria-label={count > 0 ? `${label}, ${count}` : label}
              >
                <DecorPreviewIcon decorId={asset.id} />
                <span>{label}</span>
                {count > 0 ? <span className="studio-ws__asset-count">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (state.stage === "vocea") {
    return (
      <VoiceCard
        projectId={projectId}
        hasDrawing={hasDrawing}
        onVoiceChange={onVoiceChange}
        onDraftChange={onVoiceDraftChange}
        onPlay={onPlayVoice}
      />
    );
  }

  const scene = toStudioSceneDraft(state, hasDrawing);
  const summary = sceneSummary(scene, locale);
  const storyLines = scene.context.story ? contextPreviewLines(scene.context, state, locale) : [];
  const arReady = sceneEligibility.arEligible && Boolean(arExperienceUrl);
  return (
    <div className="studio-ws__inspector-block" data-ar-eligible={sceneEligibility.arEligible ? "yes" : "no"}>
      <h2>{COPY.sceneHeading}</h2>
      <p className="studio-ws__muted">{COPY.sceneBody}</p>
      <p className="studio-ws__scene-label">{COPY.sceneLocalLabel}</p>
      <div className="studio-ws__scene-mirror">
        <GardenPoster
          state={state}
          transformMode={state.transformMode}
          drawingSrc={drawingSrc}
          mirror
        />
      </div>
      {storyLines.length > 0 ? (
        <div className="studio-ws__scene-story">
          <p className="studio-ws__scene-label">{COPY.contextPreviewTitle}</p>
          <ul>
            {storyLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="studio-ws__scene-summary">
        {summary.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
      <p className="studio-ws__scene-status">
        {arReady ? COPY.seeSceneInAr : messages.studio.arPreparing}
      </p>
      <p className="studio-ws__muted">{COPY.sceneExplanation}</p>
      <button
        type="button"
        className="studio-ws__primary-btn"
        disabled={!arReady}
        title={arReady ? undefined : COPY.sceneHelper}
        onClick={onOpenAr}
      >
        {COPY.seeSceneInAr}
      </button>
      {arReady ? null : <p className="studio-ws__muted">{COPY.sceneHelper}</p>}
    </div>
  );
}

type StartSaveState = {
  status: StartSaveStatus;
  baselineYaw: number;
  baselinePitch: number;
  baselineArAnchorMode: "marker" | "follow";
  baselineDecor: Array<{ id: string; x: number; y: number; yaw: number; pitch: number }>;
};

type StartSaveAction =
  | { type: "saving" }
  | {
      type: "saved";
      yaw: number;
      pitch: number;
      arAnchorMode: "marker" | "follow";
      decor: Array<{ id: string; x: number; y: number; yaw: number; pitch: number }>;
    }
  | { type: "error" };

function startSaveReducer(current: StartSaveState, action: StartSaveAction): StartSaveState {
  if (action.type === "saving") return { ...current, status: "saving" };
  if (action.type === "saved") {
    return {
      status: "saved",
      baselineYaw: action.yaw,
      baselinePitch: action.pitch,
      baselineArAnchorMode: action.arAnchorMode,
      baselineDecor: action.decor
    };
  }
  return { ...current, status: "error" };
}

/**
 * Studio personalize workspace — local fixture shell + optional saved drawing from Atelier.
 * Singura scriere aprobată este PATCH-ul pentru poziția de start a modelului.
 * Fără cameră hardware, fără publicare și fără generare GLB.
 */
function InteractionPanel({
  hasDrawing,
  enabled,
  activeTarget,
  reactionNonce,
  onToggle,
  onZoom,
  onNudge,
  onReset
}: {
  hasDrawing: boolean;
  enabled: boolean;
  activeTarget: "none" | "character" | "decor";
  reactionNonce: number;
  onToggle: () => void;
  onZoom: (direction: -1 | 1) => void;
  onNudge: (direction: -1 | 1) => void;
  onReset: () => void;
}) {
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;
  const reaction =
    enabled && activeTarget === "character" && reactionNonce > 0
      ? COPY.interactCharacter
      : enabled && activeTarget === "decor"
        ? COPY.interactDecor
        : "";
  const controlsDisabled = !hasDrawing || !enabled;
  return (
    <section className="studio-ws__interact" aria-labelledby="studio-interact-title">
      <h2 id="studio-interact-title">{COPY.interactTitle}</h2>
      <p className="studio-ws__interact-sub">{COPY.interactSubtitle}</p>
      <p className="studio-ws__muted">{COPY.interactIntro}</p>
      {hasDrawing ? null : <p className="studio-ws__muted">{messages.studio.addDrawingFirst}</p>}
      {enabled ? <p className="studio-ws__interact-status">{COPY.interactActive}</p> : null}
      {enabled ? <p className="studio-ws__muted">{COPY.interactHint}</p> : null}
      <div className="studio-ws__interact-actions">
        <button type="button" className="studio-ws__btn-secondary" disabled={!hasDrawing} onClick={onToggle}>
          {enabled ? COPY.interactStop : COPY.interactStart}
        </button>
        <button type="button" className="studio-ws__btn-secondary" disabled={controlsDisabled} onClick={() => onNudge(-1)}>
          {COPY.interactLeft}
        </button>
        <button type="button" className="studio-ws__btn-secondary" disabled={controlsDisabled} onClick={() => onNudge(1)}>
          {COPY.interactRight}
        </button>
      </div>
      <div className="studio-ws__interact-zoom" role="group" aria-label={COPY.interactZoom}>
        <span>{COPY.interactZoom}</span>
        <button type="button" aria-label={COPY.interactZoomOut} disabled={controlsDisabled} onClick={() => onZoom(-1)}>
          −
        </button>
        <button type="button" aria-label={COPY.interactZoomIn} disabled={controlsDisabled} onClick={() => onZoom(1)}>
          +
        </button>
        <button type="button" aria-label={messages.studio.resetScene} disabled={controlsDisabled} onClick={onReset}>
          {messages.studio.resetScene}
        </button>
      </div>
      <p className="studio-ws__interact-live" role="status" aria-live="polite">
        {reaction}
      </p>
      <p className="studio-ws__muted">{COPY.interactHonest}</p>
      <p className="studio-ws__muted">{COPY.interactArLater}</p>
    </section>
  );
}

export function PersonalizePreviewShell({
  drawingSrc = null,
  projectContext = null,
  initialIdeaPrompt = ""
}: {
  drawingSrc?: string | null;
  projectContext?: PreviewProjectContext | null;
  initialIdeaPrompt?: string;
}) {
  const { locale, messages } = useStudioI18n();
  const COPY = messages.personalize;
  const projectId = projectContext?.projectId ?? null;
  const orbitSeed = {
    hasDrawing: Boolean(drawingSrc),
    yaw: projectContext?.startYaw ?? null,
    pitch: projectContext?.startPitch ?? null,
    arAnchorMode: projectContext?.arAnchorMode ?? null,
    ideaPrompt: initialIdeaPrompt
  };
  const [state, dispatch] = useReducer(reducer, createWorkspaceState(orbitSeed));
  const [interaction, interactDispatch] = useReducer(reduceInteraction, createInteractionState());
  const [save, saveDispatch] = useReducer(startSaveReducer, {
    status: "idle",
    baselineYaw: orbitSeed.yaw ?? createInitialPersonalizeState().orbitYaw,
    baselinePitch: orbitSeed.pitch ?? createInitialPersonalizeState().orbitPitch,
    baselineArAnchorMode:
      orbitSeed.arAnchorMode ?? createInitialPersonalizeState().arAnchorMode,
    baselineDecor: []
  });
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatusView | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [publishStatus, setPublishStatus] = useState<PublishStatusResponse | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [livePublicUrls, setLivePublicUrls] = useState({
    html: projectContext?.publicHtmlUrl ?? null,
    qr: projectContext?.publicQrUrl ?? null,
    pdf: projectContext?.publicPdfUrl ?? null,
    experience: projectContext?.publicExperienceUrl ?? null
  });
  const savedVoice = voiceStatus?.voice ?? null;
  const draftMessage = voiceDraft?.message.trim() ?? "";
  const liveVoice = voiceDraft
    ? draftMessage || savedVoice?.message
      ? { role: voiceDraft.role, message: draftMessage || savedVoice!.message }
      : null
    : savedVoice;
  const [spokenMessage, setSpokenMessage] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const narratorPlayedRef = useRef(false);
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastY: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(state.zoom);
  const interactDispatchRef = useRef(interactDispatch);
  zoomRef.current = state.zoom;
  interactDispatchRef.current = interactDispatch;
  const publishDialogRef = useRef<HTMLDivElement | null>(null);
  const summary = summarizePersonalize(state, locale);
  const activeStageLabel = messages.studio.steps[STAGE_MESSAGE_KEY[state.stage]];
  const hasDrawing = Boolean(drawingSrc);
  const startDirty = isStartPoseDirty(
    {
      yaw: state.orbitYaw,
      pitch: state.orbitPitch,
      arAnchorMode: state.arAnchorMode,
      decor: state.decor
    },
    {
      yaw: save.baselineYaw,
      pitch: save.baselinePitch,
      arAnchorMode: save.baselineArAnchorMode,
      decor: save.baselineDecor
    }
  );
  const startPresentation = startSavePresentation({
    hasProject: Boolean(projectContext),
    dirty: startDirty,
    status: save.status,
    copy: COPY.startSave
  });

  const onSaveStart = async () => {
    if (!projectContext || startPresentation.disabled) return;
    const yaw = state.orbitYaw;
    const pitch = state.orbitPitch;
    const decor = state.decor.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      yaw: item.yaw,
      pitch: item.pitch
    }));
    if (state.autoRotate) dispatch({ type: "autoRotate", value: false });
    saveDispatch({ type: "saving" });
    const ok = await patchStartTransform(
      projectContext.projectId,
      buildStartTransformPatch({
        yaw,
        pitch,
        offset: projectContext.offset,
        scale: projectContext.scale,
        arAnchorMode: state.arAnchorMode,
        decor
      })
    );
    saveDispatch(
      ok
        ? { type: "saved", yaw, pitch, arAnchorMode: state.arAnchorMode, decor }
        : { type: "error" }
    );
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (el.querySelector("[data-interacting='yes']")) {
        event.preventDefault();
        interactDispatchRef.current({ type: "wheel", deltaY: event.deltaY });
        return;
      }
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

  const experienceUrl = livePublicUrls.experience ?? livePublicUrls.html;
  const sceneEligibility = evaluateFutureSceneEligibility({
    technicalStatus: experienceUrl
      ? "ready"
      : publishStatus?.phase === "failed"
        ? "failed"
        : "pending",
    sceneAssetAvailable: Boolean(drawingSrc || experienceUrl),
    qualityReview: experienceUrl ? "approved" : "pending",
    arFormatAvailable: Boolean(experienceUrl),
    arFlag: projectContext?.arFeatureEnabled ? "true" : undefined,
    authenticated: Boolean(projectId),
    owner: Boolean(projectId)
  });
  const arLive = sceneEligibility.arEligible && Boolean(experienceUrl);

  const openAr = () => {
    if (!experienceUrl || !arLive) return;
    dispatch({ type: "arLive", value: true });
    window.open(experienceUrl, "_blank", "noopener,noreferrer");
  };

  const onPublishWorld = async () => {
    if (!projectId || !projectContext || publishBusy) return;
    setPublishBusy(true);
    setPublishError(null);
    const decor = state.decor.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      yaw: item.yaw,
      pitch: item.pitch
    }));
    const saved = await patchStartTransform(
      projectContext.projectId,
      buildStartTransformPatch({
        yaw: state.orbitYaw,
        pitch: state.orbitPitch,
        offset: projectContext.offset,
        scale: projectContext.scale,
        arAnchorMode: state.arAnchorMode,
        decor
      })
    );
    if (!saved) {
      setPublishError("save_failed");
      setPublishBusy(false);
      return;
    }
    saveDispatch({
      type: "saved",
      yaw: state.orbitYaw,
      pitch: state.orbitPitch,
      arAnchorMode: state.arAnchorMode,
      decor
    });
    const result = await startPublish(projectId, { acceptTerms: true });
    if (!result.ok) {
      setPublishError(result.error);
      setPublishBusy(false);
      return;
    }
    const status = await readPublishStatus(projectId);
    if (status.ok) {
      setPublishStatus(status.status);
      setLivePublicUrls(status.status.publicUrls);
    }
    setPublishBusy(false);
  };

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      const result = await readPublishStatus(projectId);
      if (cancelled || !result.ok) return;
      setPublishStatus(result.status);
      setLivePublicUrls(result.status.publicUrls);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !shouldPollPublish(publishStatus)) return;
    const id = window.setInterval(() => {
      void (async () => {
        const result = await readPublishStatus(projectId);
        if (!result.ok) return;
        setPublishStatus(result.status);
        setLivePublicUrls(result.status.publicUrls);
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [projectId, publishStatus]);

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

  useEffect(() => {
    if (!projectId) {
      setVoiceStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await readCharacterVoiceStatus(projectId, PRIMARY_CHARACTER_ID);
      if (cancelled || !result.ok) return;
      setVoiceStatus(result.status);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const stopVoiceAudio = () => {
    const current = voiceAudioRef.current;
    if (!current) return;
    current.pause();
    current.src = "";
    voiceAudioRef.current = null;
  };

  const playVoiceClip = (url: string | null | undefined) => {
    stopVoiceAudio();
    if (!url) return;
    const audio = new Audio(url);
    voiceAudioRef.current = audio;
    audio.addEventListener("ended", () => {
      if (voiceAudioRef.current !== audio) return;
      voiceAudioRef.current = null;
      setSpokenMessage(null);
    });
    void audio.play().catch(() => {
      // Autoplay can be blocked until a gesture; narrator waits for interact toggle.
    });
  };

  const speakCharacter = (mode: "narrator" | "hidden" | "tap") => {
    const voice = liveVoice;
    if (!voice) return;
    if (mode === "narrator" && voice.role !== "narrator") return;
    if (mode === "hidden" && voice.role !== "hidden") return;
    setSpokenMessage(voice.message);
    playVoiceClip(voiceStatus?.audioUrl);
  };

  const silenceCharacter = () => {
    setSpokenMessage(null);
    stopVoiceAudio();
  };

  useEffect(() => {
    if (!interaction.enabled) {
      narratorPlayedRef.current = false;
      setSpokenMessage(null);
      stopVoiceAudio();
      return;
    }
    if (narratorPlayedRef.current) return;
    if (liveVoice?.role !== "narrator") return;
    narratorPlayedRef.current = true;
    speakCharacter("narrator");
    // Speak once when interactions turn on with a narrator voice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.enabled, liveVoice?.role, liveVoice?.message, voiceStatus?.audioUrl]);

  useEffect(() => {
    // Narrator replays only after interactions are toggled off and on again.
    setSpokenMessage(null);
    stopVoiceAudio();
  }, [state.stage]);

  useEffect(() => {
    return () => {
      stopVoiceAudio();
    };
  }, []);

  const markDragging = (active: boolean) => {
    const el = viewportRef.current;
    if (!el) return;
    if (active) el.dataset.dragging = "yes";
    else delete el.dataset.dragging;
  };

  const onCharacterClick = () => {
    interactDispatch({ type: "character" });
    if (!liveVoice) return;
    // Tapping a speaking character stops it; tapping a silent one makes it speak (either role).
    if (spokenMessage !== null) {
      silenceCharacter();
      return;
    }
    speakCharacter("tap");
  };

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "input, label, a, .studio-ws__overlay-tools, .studio-ws__viewport-bar, .studio-ws__start-save, .studio-stage__prop button"
      )
    ) {
      return;
    }
    if (target.closest("button") && !target.closest(".studio-stage__hit")) return;
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
      title={projectId ? COPY.publishPrepareTitle : COPY.previewOnlyTitle}
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
      {variant === "sheet" ? (
      <div className="studio-ws__viewport-bar">
        <div className="studio-ws__cam-presets" role="group" aria-label={COPY.cameraSection}>
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
                {COPY.choices.cameras[preset.id].label}
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
      data-ar-live={arLive ? "yes" : "no"}
      data-sheet={state.leftOpen || state.rightOpen ? "open" : "closed"}
    >
      <a className="studio-ws__skip" href="#studio-ws-main">
        {messages.accessibility.skipToContent}
      </a>

      <SiteHeader
        brandHref={PERSONALIZE_BACK_HREF}
        studioHref={PERSONALIZE_BACK_HREF}
        locale={locale}
        menuLabel={messages.accessibility.menu}
        languageLabel={messages.accessibility.languageSelector}
        trailing={
          <div className="studio-ws__header-actions">
            <span className="studio-ws__saved" aria-live="polite">
              {COPY.savedLocal}
            </span>
            {renderPublish()}
            <button
              type="button"
              className="studio-ws__btn-primary"
              disabled={!arLive}
              title={arLive ? undefined : COPY.sceneHelper}
              onClick={openAr}
            >
              {COPY.seeSceneInAr}
            </button>
          </div>
        }
        mobileExtra={
          <>
            <p className="studio-ws__saved studio-ws__saved--sheet">{COPY.savedLocal}</p>
            {renderPublish()}
            <button
              type="button"
              className="studio-ws__btn-primary"
              disabled={!arLive}
              title={arLive ? undefined : COPY.sceneHelper}
              onClick={openAr}
            >
              {COPY.seeSceneInAr}
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
            closeLabel={COPY.closePanel}
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
              projectId={projectId}
              interaction={interaction}
              spokenMessage={spokenMessage}
              onCharacterClick={onCharacterClick}
              onDecorActivate={() => interactDispatch({ type: "decor" })}
              onDecorMove={(key, x, y) => dispatch({ type: "decorMove", key, x, y })}
              onDecorOrbit={(key, yaw, pitch) => dispatch({ type: "decorOrbit", key, yaw, pitch })}
              onDecorRemove={(key) => dispatch({ type: "decorRemove", key })}
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
              <p className="studio-ws__viewport-step">{activeStageLabel}</p>
            </div>

            <div className="studio-ws__overlay-tools">
            <div className="studio-ws__viewport-bar">
              <div className="studio-ws__cam-presets" role="group" aria-label={COPY.cameraSection}>
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
                      {COPY.choices.cameras[preset.id].label}
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
          <InteractionPanel
            hasDrawing={hasDrawing}
            enabled={interaction.enabled}
            activeTarget={interaction.activeTarget}
            reactionNonce={interaction.reactionNonce}
            onToggle={() => interactDispatch({ type: "enable", enabled: !interaction.enabled })}
            onZoom={(direction) => interactDispatch({ type: "zoom", direction })}
            onNudge={(direction) => interactDispatch({ type: "nudge", direction })}
            onReset={() => interactDispatch({ type: "reset" })}
          />
        </section>

        <aside
          className={`studio-ws__right${state.rightOpen ? " is-open" : ""}`}
          aria-label={COPY.rightNavOpen}
        >
          <SheetChrome
            title={activeStageLabel ?? COPY.rightNavOpen}
            closeLabel={COPY.closePanel}
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
            sceneEligibility={sceneEligibility}
            arExperienceUrl={experienceUrl}
            onOpenAr={openAr}
            onVoiceChange={setVoiceStatus}
            onVoiceDraftChange={setVoiceDraft}
            onPlayVoice={playVoiceClip}
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
        <button
          type="button"
          className="studio-ws__dock-cta"
          disabled={!arLive}
          title={arLive ? undefined : COPY.sceneHelper}
          onClick={openAr}
        >
          {COPY.seeSceneInAr}
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
            {publishStatus?.phase === "building" ? (
              <p className="studio-ws__muted" aria-live="polite">
                {publishStatus.steps.map((step) => `${step.type}: ${step.label}`).join(" · ")}
              </p>
            ) : null}
            {publishError ? <p className="studio-ws__muted">{publishError}</p> : null}
            <figure className="studio-ws__publish-qr">
              {livePublicUrls.qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={livePublicUrls.qr} alt={COPY.publishQrLabel} width={192} height={192} />
              ) : (
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <rect x="4" y="4" width="18" height="18" />
                  <rect x="42" y="4" width="18" height="18" />
                  <rect x="4" y="42" width="18" height="18" />
                  <rect x="28" y="28" width="8" height="8" />
                  <rect x="40" y="40" width="6" height="6" />
                  <rect x="50" y="28" width="8" height="8" />
                  <rect x="28" y="48" width="8" height="8" />
                </svg>
              )}
              <figcaption>{COPY.publishQrLabel}</figcaption>
            </figure>
            {experienceUrl ? (
              <p>
                <a href={experienceUrl} target="_blank" rel="noopener noreferrer">
                  {experienceUrl}
                </a>
              </p>
            ) : null}
            {livePublicUrls.pdf ? (
              <p>
                <a href={livePublicUrls.pdf} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              </p>
            ) : null}
            <div className="studio-ws__publish-actions">
              <button
                type="button"
                className="studio-ws__btn-primary"
                disabled={publishBusy || publishStatus?.phase === "building"}
                onClick={() => {
                  void onPublishWorld();
                }}
              >
                {COPY.publishWorld}
              </button>
              {arLive ? null : <p className="studio-ws__publish-inactive">{COPY.publishInactive}</p>}
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
