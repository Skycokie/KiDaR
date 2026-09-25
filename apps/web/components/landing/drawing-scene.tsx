"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { StaticImageData } from "next/image";
import heroRedDress from "./art/hero-red-dress.png";
import childOpenArms from "./art/child-open-arms.png";
import childGreenShirt from "./art/child-green-shirt.png";
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

/**
 * Paper-card illustrations. The source PNGs are opaque RGB, so the white
 * field stays as the card surface. Motion is CSS only; this effect adds
 * desktop pointer parallax and pauses idle motion while the tab is hidden.
 * Approved demo GLBs load only after hover/click; PNG remains the default.
 */
export function DrawingScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const onVisibility = () => {
      root.toggleAttribute("data-paused", document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const sceneObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      root.toggleAttribute("data-offscreen", !entry.isIntersecting);
    });
    sceneObserver.observe(root);

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      root.style.setProperty("--px", px.toFixed(3));
      root.style.setProperty("--py", py.toFixed(3));
    };
    const onLeave = () => {
      root.style.setProperty("--px", "0");
      root.style.setProperty("--py", "0");
    };

    if (fine.matches) {
      root.classList.add("can-parallax");
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
    }

    return () => {
      sceneObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.classList.remove("can-parallax");
    };
  }, []);

  return (
    <div className="kidar-scene" ref={rootRef} aria-hidden="true">
      <div className="kidar-scene__shift">
        <CharacterPaperCard
          src={heroRedDress}
          variant="red-dress"
          sizes="(max-width: 899px) 200px, 280px"
          priority
          demo={HOMEPAGE_DEMO_CHARACTERS.redDress}
        />
        <CharacterPaperCard
          src={childOpenArms}
          variant="open-arms"
          sizes="(max-width: 899px) 140px, 160px"
          loading="eager"
          demo={HOMEPAGE_DEMO_CHARACTERS.openArms}
        />
        <CharacterPaperCard
          src={childGreenShirt}
          variant="green-shirt"
          sizes="(max-width: 899px) 140px, 160px"
          loading="eager"
          demo={HOMEPAGE_DEMO_CHARACTERS.greenShirt}
        />
      </div>
    </div>
  );
}

export function LandingRooster() {
  return (
    <div className="landing-rooster">
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
