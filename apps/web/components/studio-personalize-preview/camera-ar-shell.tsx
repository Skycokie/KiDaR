"use client";

import Link from "next/link";
import { useReducer } from "react";
import { CameraArScene } from "./camera-ar-scene";
import { CAMERA_AR_COPY, CAMERA_AR_STUDIO_HREF } from "./camera-ar-fixtures";
import {
  cameraArStatusMessage,
  continueFromPreparing,
  createInitialCameraArState,
  markFound,
  markLost,
  retrySearch,
  showIncompatible,
  showUnavailable,
  startPreview,
  type CameraArState
} from "./camera-ar-state";
import "./camera-ar-preview.css";

type Action =
  | { type: "start" }
  | { type: "continue" }
  | { type: "found" }
  | { type: "lost" }
  | { type: "retry" }
  | { type: "unavailable" }
  | { type: "incompatible" };

function reducer(state: CameraArState, action: Action): CameraArState {
  switch (action.type) {
    case "start":
      return startPreview(state);
    case "continue":
      return continueFromPreparing(state);
    case "found":
      return markFound(state);
    case "lost":
      return markLost(state);
    case "retry":
      return retrySearch(state);
    case "unavailable":
      return showUnavailable(state);
    case "incompatible":
      return showIncompatible(state);
    default:
      return state;
  }
}

/**
 * Cameră AR Preview Go B — interactive static mock.
 * Zero device camera, zero network, zero persistence.
 */
export function CameraArPreviewShell() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialCameraArState);
  const status = cameraArStatusMessage(state.phase);
  const endState = state.phase === "unavailable" || state.phase === "incompatible";

  return (
    <div className="cam-ar" data-studio-mode="camera-ar-go-b" data-phase={state.phase}>
      <a className="cam-ar__skip" href="#cam-ar-main">
        Sari la conținut
      </a>

      <header className="cam-ar__top">
        <Link className="cam-ar__brand" href={CAMERA_AR_STUDIO_HREF}>
          kidAR
        </Link>
        <p className="cam-ar__badge">{CAMERA_AR_COPY.badge}</p>
      </header>

      <main id="cam-ar-main" className="cam-ar__main">
        <p className="cam-ar__kicker">Cameră AR</p>

        {state.phase === "intro" ? (
          <h1 className="cam-ar__title">{CAMERA_AR_COPY.introTitle}</h1>
        ) : (
          <h1 className="cam-ar__title cam-ar__title--status">{status}</h1>
        )}

        {state.phase === "intro" ? (
          <p className="cam-ar__lead">{CAMERA_AR_COPY.introLead}</p>
        ) : (
          <p className="cam-ar__hint">{CAMERA_AR_COPY.worldHint}</p>
        )}

        <p className="cam-ar__live" aria-live="polite">
          {status}
        </p>

        <CameraArScene phase={state.phase} />

        <div className="cam-ar__actions">
          {state.phase === "intro" ? (
            <button type="button" className="cam-ar__cta" onClick={() => dispatch({ type: "start" })}>
              {CAMERA_AR_COPY.tryPreview}
            </button>
          ) : null}

          {state.phase === "preparing" ? (
            <button type="button" className="cam-ar__cta" onClick={() => dispatch({ type: "continue" })}>
              {CAMERA_AR_COPY.continue}
            </button>
          ) : null}

          {state.phase === "searching" ? (
            <button type="button" className="cam-ar__cta" onClick={() => dispatch({ type: "found" })}>
              {CAMERA_AR_COPY.simulateFound}
            </button>
          ) : null}

          {state.phase === "found" ? (
            <button type="button" className="cam-ar__ghost" onClick={() => dispatch({ type: "lost" })}>
              {CAMERA_AR_COPY.simulateLost}
            </button>
          ) : null}

          {state.phase === "lost" ? (
            <button type="button" className="cam-ar__cta" onClick={() => dispatch({ type: "retry" })}>
              {CAMERA_AR_COPY.showAgain}
            </button>
          ) : null}

          <Link className="cam-ar__ghost" href={CAMERA_AR_STUDIO_HREF}>
            {CAMERA_AR_COPY.backStudio}
          </Link>
        </div>

        {!endState ? (
          <div className="cam-ar__demo">
            <p className="cam-ar__demo-label">{CAMERA_AR_COPY.demoLabel}</p>
            <div className="cam-ar__demo-row">
              <button
                type="button"
                className="cam-ar__chip"
                onClick={() => dispatch({ type: "unavailable" })}
              >
                {CAMERA_AR_COPY.demoUnavailable}
              </button>
              <button
                type="button"
                className="cam-ar__chip"
                onClick={() => dispatch({ type: "incompatible" })}
              >
                {CAMERA_AR_COPY.demoIncompatible}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
