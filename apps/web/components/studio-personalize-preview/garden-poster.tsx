import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { COPY, type TransformModeId } from "./fixtures";
import type { PersonalizeState } from "./form-state";
import {
  FIXTURE_POPOUT_PARTS,
  POPOUT_EDGE_COLORS,
  figurinePuff,
  figurineVolumeScale,
  popoutExtrusionPx,
  popoutLayerOffsetsPx
} from "./popout-preview-layers";

const PopoutMeshStage = dynamic(
  () => import("./popout-mesh-stage").then((mod) => mod.PopoutMeshStage),
  { ssr: false }
);

/**
 * Studio stage preview. Transform mode is an explicit prop from the shell.
 * Project photos use the local Three pop-out (cutout + ExtrudeGeometry).
 * Figurine stays a local clay/toy mock. Fixture pop-out stays SVG when there is no photo.
 */

function FixturePartShapes({
  partId,
  face
}: {
  partId: (typeof FIXTURE_POPOUT_PARTS)[number]["id"];
  face: boolean;
}) {
  if (partId === "legs") {
    return (
      <>
        <ellipse className={face ? "studio-stage__leg" : undefined} cx="64" cy="158" rx="12" ry="22" />
        <ellipse className={face ? "studio-stage__leg" : undefined} cx="96" cy="158" rx="12" ry="22" />
      </>
    );
  }
  if (partId === "torso") {
    return <ellipse className={face ? "studio-stage__torso" : undefined} cx="80" cy="112" rx="38" ry="48" />;
  }
  if (partId === "arms") {
    return (
      <>
        <ellipse
          className={face ? "studio-stage__arm studio-stage__arm--l" : undefined}
          cx="42"
          cy="108"
          rx="12"
          ry="28"
        />
        <ellipse
          className={face ? "studio-stage__arm studio-stage__arm--r" : undefined}
          cx="118"
          cy="108"
          rx="12"
          ry="28"
        />
      </>
    );
  }
  return (
    <>
      <circle className={face ? "studio-stage__head" : undefined} cx="80" cy="52" r="28" />
      {face ? (
        <>
          <ellipse className="studio-stage__cheek" cx="62" cy="56" rx="6" ry="4" />
          <ellipse className="studio-stage__cheek" cx="98" cy="56" rx="6" ry="4" />
          <circle className="studio-stage__eye" cx="70" cy="50" r="3.2" />
          <circle className="studio-stage__eye" cx="90" cy="50" r="3.2" />
          <path
            className="studio-stage__smile"
            d="M70 62 Q80 70 90 62"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </>
  );
}

function PopoutFixtureFigure({ volume }: { volume: number }) {
  const offsets = popoutLayerOffsetsPx(volume);
  const depth = popoutExtrusionPx(volume);
  // Deepest edge layers first so faces paint on top in DOM order.
  const stacked = [...FIXTURE_POPOUT_PARTS].sort((a, b) => b.depthLevel - a.depthLevel);

  return (
    <div
      className="studio-stage__popout studio-stage__popout--fixture"
      style={{ "--popout-depth": `${depth}px` } as CSSProperties}
    >
      <div className="studio-stage__popout-stack" aria-hidden="true">
        {stacked.map((part) => {
          const z = offsets[part.depthLevel] ?? 0;
          const step = part.depthLevel + 1;
          return (
            <div
              key={`edge-${part.id}`}
              className={`studio-stage__popout-sheet studio-stage__popout-sheet--${part.id} is-edge`}
              style={
                {
                  "--layer-z": `${-Math.max(6, z)}px`,
                  "--layer-shift-x": `${step * 2.2}px`,
                  "--layer-shift-y": `${step * 1.05}px`,
                  "--layer-scale": String(1 + step * 0.018),
                  "--layer-edge": part.edge
                } as CSSProperties
              }
            >
              <svg viewBox="0 0 160 200" className="studio-stage__svg studio-stage__svg--popout">
                <g fill={part.edge}>
                  <FixturePartShapes partId={part.id} face={false} />
                </g>
              </svg>
            </div>
          );
        })}

        {FIXTURE_POPOUT_PARTS.map((part) => {
          const z = offsets[part.depthLevel] ?? 0;
          return (
            <div
              key={`face-${part.id}`}
              className={`studio-stage__popout-sheet studio-stage__popout-sheet--${part.id} is-face`}
              style={
                {
                  "--layer-z": `${-Math.max(0, z * 0.08)}px`,
                  "--layer-shift-x": "0px",
                  "--layer-shift-y": "0px",
                  "--layer-scale": "1"
                } as CSSProperties
              }
            >
              <svg viewBox="0 0 160 200" className="studio-stage__svg studio-stage__svg--popout">
                <defs>
                  <linearGradient id={`studio-body-grad-${part.id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop className="studio-stage__grad-hi" offset="0%" />
                    <stop className="studio-stage__grad-lo" offset="100%" />
                  </linearGradient>
                </defs>
                <g fill={`url(#studio-body-grad-${part.id})`}>
                  <FixturePartShapes partId={part.id} face />
                </g>
              </svg>
            </div>
          );
        })}
      </div>
      <span className="studio-stage__popout-contact" aria-hidden="true" />
    </div>
  );
}

function FigurineDrawingShell({
  drawingSrc,
  volume,
  preserveOutline
}: {
  drawingSrc: string;
  volume: number;
  preserveOutline: boolean;
}) {
  const scale = figurineVolumeScale(volume);
  const puff = figurinePuff(volume);

  return (
    <div
      className="studio-stage__figurine studio-stage__figurine--drawing"
      style={
        {
          "--figurine-scale": String(scale),
          "--figurine-puff": String(puff),
          "--figurine-edge": POPOUT_EDGE_COLORS.warm
        } as CSSProperties
      }
    >
      <span className="studio-stage__figurine-bevel" aria-hidden="true" />
      <span className="studio-stage__figurine-rimlight" aria-hidden="true" />
      <div className="studio-stage__figurine-core">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="studio-stage__drawing-img"
          src={drawingSrc}
          alt="Desenul salvat din Atelier"
          draggable={false}
        />
        {preserveOutline ? <span className="studio-stage__drawing-edge" aria-hidden="true" /> : null}
      </div>
      <span className="studio-stage__figurine-specular" aria-hidden="true" />
      <span className="studio-stage__figurine-contact" aria-hidden="true" />
    </div>
  );
}

function FigurineFixtureFigure({ volume }: { volume: number }) {
  const scale = figurineVolumeScale(volume);
  const puff = figurinePuff(volume);
  // Plumper toy proportions — still the same silhouette language as the fixture drawing.
  const bodyRx = 38 * puff;
  const bodyRy = 50 * puff;
  const headR = 30 * Math.min(1.12, puff);
  const armRx = 14 * puff;
  const armRy = 30 * puff;
  const legRx = 14 * puff;
  const legRy = 24 * puff;

  return (
    <div
      className="studio-stage__figurine studio-stage__figurine--fixture"
      style={
        {
          "--figurine-scale": String(scale),
          "--figurine-puff": String(puff),
          "--figurine-edge": POPOUT_EDGE_COLORS.warm
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 160 200" className="studio-stage__svg studio-stage__svg--figurine" aria-hidden="true">
        <defs>
          <linearGradient id="studio-figurine-body" x1="0.15" y1="0" x2="0.9" y2="1">
            <stop className="studio-stage__grad-hi" offset="0%" />
            <stop className="studio-stage__grad-lo" offset="100%" />
          </linearGradient>
          <radialGradient id="studio-figurine-sheen" cx="32%" cy="28%" r="55%">
            <stop offset="0%" stopColor="rgba(255, 236, 210, 0.55)" />
            <stop offset="55%" stopColor="rgba(255, 214, 160, 0.12)" />
            <stop offset="100%" stopColor="rgba(255, 214, 160, 0)" />
          </radialGradient>
          <radialGradient id="studio-figurine-contact" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(40, 24, 12, 0.55)" />
            <stop offset="70%" stopColor="rgba(40, 24, 12, 0.18)" />
            <stop offset="100%" stopColor="rgba(40, 24, 12, 0)" />
          </radialGradient>
        </defs>

        <ellipse
          className="studio-stage__figurine-ground"
          cx="80"
          cy="186"
          rx={58 * puff}
          ry={12 * puff}
          fill="url(#studio-figurine-contact)"
        />

        {/* Soft warm under-bevel — clay rim, never blue */}
        <g className="studio-stage__figurine-under" fill={POPOUT_EDGE_COLORS.deep} opacity="0.88">
          <ellipse cx="80" cy={114} rx={bodyRx + 3.5} ry={bodyRy + 3.5} />
          <circle cx="80" cy="52" r={headR + 3} />
          <ellipse cx="40" cy="108" rx={armRx + 2.5} ry={armRy + 2.5} />
          <ellipse cx="120" cy="108" rx={armRx + 2.5} ry={armRy + 2.5} />
          <ellipse cx="62" cy="160" rx={legRx + 2.2} ry={legRy + 2.2} />
          <ellipse cx="98" cy="160" rx={legRx + 2.2} ry={legRy + 2.2} />
        </g>

        <g className="studio-stage__body studio-stage__body--figurine" fill="url(#studio-figurine-body)">
          <ellipse className="studio-stage__torso" cx="80" cy="112" rx={bodyRx} ry={bodyRy} />
          <circle className="studio-stage__head" cx="80" cy="52" r={headR} />
          <ellipse className="studio-stage__arm studio-stage__arm--l" cx="42" cy="108" rx={armRx} ry={armRy} />
          <ellipse className="studio-stage__arm studio-stage__arm--r" cx="118" cy="108" rx={armRx} ry={armRy} />
          <ellipse className="studio-stage__leg" cx="64" cy="158" rx={legRx} ry={legRy} />
          <ellipse className="studio-stage__leg" cx="96" cy="158" rx={legRx} ry={legRy} />
        </g>

        {/* Painted-toy sheen + key highlight */}
        <ellipse
          className="studio-stage__figurine-sheen"
          cx="80"
          cy="100"
          rx={bodyRx * 0.92}
          ry={bodyRy * 0.92}
          fill="url(#studio-figurine-sheen)"
        />
        <ellipse
          className="studio-stage__figurine-spec"
          cx="68"
          cy="42"
          rx="10"
          ry="6"
          fill="rgba(255, 244, 220, 0.45)"
        />

        <ellipse className="studio-stage__cheek" cx="62" cy="56" rx="7" ry="4.5" />
        <ellipse className="studio-stage__cheek" cx="98" cy="56" rx="7" ry="4.5" />
        <circle className="studio-stage__eye" cx="70" cy="50" r="3.4" />
        <circle className="studio-stage__eye" cx="90" cy="50" r="3.4" />
        <path
          className="studio-stage__smile"
          d="M70 62 Q80 71 90 62"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function GardenPoster({
  state,
  transformMode,
  drawingSrc,
  showOriginalPage = false
}: {
  state: PersonalizeState;
  transformMode: TransformModeId;
  drawingSrc?: string | null;
  showOriginalPage?: boolean;
}) {
  const scale = state.zoom / 100;
  const isFigurine = transformMode === "figurine";
  const isPopout = transformMode === "popout";
  // Pop-out: shallow paper lift. Figurine: steeper Volum response.
  const volumeScale = isFigurine
    ? figurineVolumeScale(state.volume)
    : 0.72 + state.volume / 180;
  const hasDrawing = Boolean(drawingSrc);
  const contrast = 0.85 + state.details / 250;
  const brightness = 0.72 + state.light / 180;
  const saturate = state.originalColors ? 1 : 0.55 + state.variantIndex * 0.2;
  const extrusion = popoutExtrusionPx(state.volume);

  return (
    <div
      className={`studio-stage studio-stage--${state.stylePreset}${state.gridOn ? " is-grid" : ""}${hasDrawing ? " has-drawing" : ""}`}
      data-mode={transformMode}
      data-animation={state.animation}
      data-palette={state.palette}
      data-lighting={state.lighting}
      data-decor={state.decor[0] ?? "none"}
      data-outline={state.preserveOutline ? "yes" : "no"}
      data-colors={state.originalColors ? "original" : "styled"}
      data-variant={state.variantIndex}
      style={
        {
          "--studio-zoom": String(scale),
          "--studio-volume": String(volumeScale),
          "--studio-light": String(isFigurine ? Math.min(1, state.light / 100 + 0.18) : state.light / 100),
          "--studio-shadow": String(
            isFigurine
              ? Math.min(1, state.shadow / 100 + 0.28)
              : Math.max(0.18, state.shadow / 100 * 0.85)
          ),
          "--studio-details": String(0.35 + state.details / 200),
          "--studio-yaw": `${state.orbitYaw}deg`,
          "--studio-pitch": `${state.orbitPitch}deg`,
          "--studio-roll": `${state.orbitRoll}deg`,
          "--studio-contrast": String(contrast),
          "--studio-brightness": String(brightness),
          "--studio-saturate": String(saturate),
          "--popout-depth": `${extrusion}px`,
          "--popout-edge": POPOUT_EDGE_COLORS.warm,
          "--figurine-scale": String(figurineVolumeScale(state.volume)),
          "--figurine-puff": String(figurinePuff(state.volume))
        } as CSSProperties
      }
      aria-label={hasDrawing ? "Previzualizare desen pe scenă" : "Previzualizare personaj pe scenă"}
    >
      <div className="studio-stage__vignette" aria-hidden="true" />
      <div className="studio-stage__keylight" aria-hidden="true" />
      <div className="studio-stage__rim" aria-hidden="true" />
      <div className="studio-stage__horizon" aria-hidden="true" />
      <div className="studio-stage__ground" aria-hidden="true" />
      <div className="studio-stage__floor" aria-hidden="true" />

      {isPopout && hasDrawing ? (
        <PopoutMeshStage
          sourceUrl={drawingSrc!}
          volume={state.volume}
          yaw={state.orbitYaw}
          pitch={state.orbitPitch}
          roll={state.orbitRoll}
          zoom={state.zoom}
          showOriginalPage={showOriginalPage}
        />
      ) : null}

      <div className="studio-stage__orbit">
        <div className="studio-stage__actor">
        {isPopout && !hasDrawing ? <PopoutFixtureFigure volume={state.volume} /> : null}

        {isFigurine && hasDrawing ? (
          <FigurineDrawingShell
            drawingSrc={drawingSrc!}
            volume={state.volume}
            preserveOutline={state.preserveOutline}
          />
        ) : null}

        {isFigurine && !hasDrawing ? <FigurineFixtureFigure volume={state.volume} /> : null}
        </div>
      </div>
      {hasDrawing ? null : <p className="studio-stage__demo-label">{COPY.demoPreview}</p>}

      {isFigurine ? (
        <p className="studio-stage__mode-hint studio-stage__mode-hint--figurine">{COPY.figurineVolumeHint}</p>
      ) : null}

      {state.decor.length > 0 ? (
        <ul className="studio-stage__decor" aria-hidden="true">
          {state.decor.map((id) => (
            <li key={id} className={`studio-stage__prop studio-stage__prop--${id}`}>
              <span>{id}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
