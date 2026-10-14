"use client";

import dynamic from "next/dynamic";
import { useState, type KeyboardEvent } from "react";

const HeroJourneyStage = dynamic(
  () => import("./hero-journey-stage").then((mod) => mod.HeroJourneyStage),
  { ssr: false }
);

/**
 * Decorative particle story loop (draw, character, decor, voice, AR phone, QR).
 *
 * With "Reduce Motion" on, the scene stays still until the visitor taps the zone
 * (tap again to pause). No visible play/pause button.
 */
export function JourneyScene({ playLabel, pauseLabel }: { playLabel: string; pauseLabel: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);

  const toggle = () => setPlaying((value) => !value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <div
      className={`journey-scene-wrap${reducedMotion ? " journey-scene-wrap--interactive" : ""}`}
      role={reducedMotion ? "button" : undefined}
      tabIndex={reducedMotion ? 0 : undefined}
      aria-label={reducedMotion ? (playing ? pauseLabel : playLabel) : undefined}
      aria-pressed={reducedMotion ? playing : undefined}
      onClick={reducedMotion ? toggle : undefined}
      onKeyDown={reducedMotion ? onKeyDown : undefined}
    >
      <div className="journey-scene" aria-hidden="true">
        <HeroJourneyStage playing={playing} onReducedMotion={setReducedMotion} />
      </div>
    </div>
  );
}
