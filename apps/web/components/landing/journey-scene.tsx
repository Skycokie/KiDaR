"use client";

import dynamic from "next/dynamic";

const HeroJourneyStage = dynamic(
  () => import("./hero-journey-stage").then((mod) => mod.HeroJourneyStage),
  { ssr: false }
);

/** Decorative particle story loop (draw, character, decor, voice, AR phone, QR). */
export function JourneyScene() {
  return (
    <div className="journey-scene" aria-hidden="true">
      <HeroJourneyStage />
    </div>
  );
}
