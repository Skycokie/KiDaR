"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import Image, { type StaticImageData } from "next/image";
import detectiveStory from "./art/detective-story.jpg";
import detectiveYellowCoat from "./art/detective-yellow-coat.webp";
import detectiveRedHairedBoy from "./art/detective-red-haired-boy-cutout.png";
import detectivePurpleGirl from "./art/detective-purple-girl-cutout.png";
import detectiveCurlyBoy from "./art/detective-curly-boy-cutout.png";
import rooster from "./art/rooster.png";
import { CharacterPopout, type PopoutVariant } from "./character-popout";
import { HOMEPAGE_DEMO_CHARACTERS, type HomepageCharacterDemo } from "./homepage-character-assets";
import {
  activatePopout,
  createPopoutInteractionState,
  markPopoutFailed,
  markPopoutReady,
  popoutDisplayPhase,
  settlePopout,
  type PopoutInteractionState
} from "./popout-interaction";

const CharacterGlbStage = dynamic(
  () => import("./character-glb-stage").then((mod) => mod.CharacterGlbStage),
  { ssr: false }
);

function usePopoutInteraction() {
  const [state, setState] = useState<PopoutInteractionState>(createPopoutInteractionState);

  const activate = () => {
    setState((current) =>
      activatePopout(current, {
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      })
    );
  };

  return {
    state,
    activate,
    onReady: () => setState((current) => markPopoutReady(current)),
    onFallback: () => setState((current) => markPopoutFailed(current)),
    onSpinDone: () => setState((current) => settlePopout(current))
  };
}

export function DrawingScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onVisibility = () => {
      root.toggleAttribute("data-paused", document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--detective-px", px.toFixed(3));
    event.currentTarget.style.setProperty("--detective-py", py.toFixed(3));
  };

  const onLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--detective-px", "0");
    event.currentTarget.style.setProperty("--detective-py", "0");
  };

  return (
    <div
      className="detective-hero"
      ref={rootRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-hidden="true"
    >
      <div className="detective-hero__glow" />
      <div className="detective-hero__frame">
        <Image
          className="detective-hero__image"
          src={detectiveStory}
          alt=""
          fill
          priority
          sizes="(max-width: 899px) 92vw, 500px"
        />
        <div className="detective-hero__shine" />
        <DetectiveCharacter
          src={detectiveYellowCoat}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectiveYellowCoat}
          className="detective-character--hero"
        />
      </div>
    </div>
  );
}

function DetectiveCharacter({
  src,
  demo,
  className = ""
}: {
  src: StaticImageData;
  demo: HomepageCharacterDemo;
  className?: string;
}) {
  const { state, activate, onReady, onFallback, onSpinDone } = usePopoutInteraction();
  const active = state.phase === "playing" || state.phase === "loading";

  return (
    <div
      className={`detective-character ${className}`}
      data-phase={popoutDisplayPhase(state)}
      data-reveal={state.reveal}
      data-character={demo.id}
      onPointerEnter={activate}
      onClick={activate}
    >
      <div className="detective-character__portrait">
        <Image src={src} alt="" fill sizes="(max-width: 699px) 21vw, 112px" />
      </div>
      {state.mountGlb ? (
        <CharacterGlbStage
          modelUrl={demo.glbSrc}
          active={active}
          restYawRad={demo.restYawRad}
          spinId={state.spinId}
          stageClassName="detective-character__stage"
          canvasClassName="detective-character__canvas"
          onReady={onReady}
          onFallback={onFallback}
          onSpinDone={onSpinDone}
        />
      ) : null}
    </div>
  );
}

export function LandingRooster() {
  return (
    <div className="landing-rooster">
      <div className="detective-companions">
        <DetectiveCharacter
          src={detectiveRedHairedBoy}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectiveRedHairedBoy}
          className="detective-character--red"
        />
        <DetectiveCharacter
          src={detectivePurpleGirl}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectivePurpleGirl}
          className="detective-character--purple"
        />
        <DetectiveCharacter
          src={detectiveCurlyBoy}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectiveCurlyBoy}
          className="detective-character--curly"
        />
      </div>
      <CharacterPaperCard
        src={rooster}
        variant="rooster"
        sizes="200px"
        demo={HOMEPAGE_DEMO_CHARACTERS.rooster}
        stageClassName="landing-rooster__stage"
        canvasClassName="landing-rooster__canvas"
      />
    </div>
  );
}

function CharacterPaperCard({
  src,
  variant,
  sizes,
  priority = false,
  loading,
  demo,
  stageClassName,
  canvasClassName
}: {
  src: StaticImageData;
  variant: PopoutVariant;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  demo: HomepageCharacterDemo;
  stageClassName?: string;
  canvasClassName?: string;
}) {
  const { state, activate, onReady, onFallback, onSpinDone } = usePopoutInteraction();
  const displayPhase = popoutDisplayPhase(state);
  const active = state.phase === "playing" || state.phase === "loading";

  return (
    <CharacterPopout
      variant={variant}
      src={src}
      sizes={sizes}
      priority={priority}
      loading={loading}
      phase={displayPhase}
      reveal={state.reveal}
      onActivate={activate}
    >
      {state.mountGlb ? (
        <CharacterGlbStage
          modelUrl={demo.glbSrc}
          active={active}
          restYawRad={demo.restYawRad}
          spinId={state.spinId}
          stageClassName={stageClassName}
          canvasClassName={canvasClassName}
          onReady={onReady}
          onFallback={onFallback}
          onSpinDone={onSpinDone}
        />
      ) : null}
    </CharacterPopout>
  );
}
