"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const HeroJourneyStage = dynamic(
  () => import("./hero-journey-stage").then((mod) => mod.HeroJourneyStage),
  { ssr: false }
);

/**
 * Decorative particle story loop (draw, character, decor, voice, AR phone, QR).
 *
 * People who turned on "Reduce Motion" (very common on iPhone) get a still frame,
 * but we show a small play button so they can still watch the story on demand.
 */
export function JourneyScene({ playLabel, pauseLabel }: { playLabel: string; pauseLabel: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="journey-scene-wrap">
      <div className="journey-scene" aria-hidden="true">
        <HeroJourneyStage playing={playing} onReducedMotion={setReducedMotion} />
      </div>
      {reducedMotion ? (
        <button
          type="button"
          className="journey-scene__play"
          aria-pressed={playing}
          onClick={() => setPlaying((value) => !value)}
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
          {playing ? pauseLabel : playLabel}
        </button>
      ) : null}
    </div>
  );
}
