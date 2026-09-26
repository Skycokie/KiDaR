"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import dynamic from "next/dynamic";
import Image, { type StaticImageData } from "next/image";
import detectiveStory from "./art/detective-story.jpg";
import detectiveYellowCoat from "./art/detective-yellow-coat.webp";
import detectiveRedHairedBoy from "./art/detective-red-haired-boy-happy-cutout.png";
import detectivePurpleGirl from "./art/detective-purple-girl-happy-cutout.png";
import detectiveCurlyBoy from "./art/detective-curly-boy-happy-cutout.png";
import auGasitCocosul from "./art/au-gasit-cocosul.jpg";
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
import { shouldHeroSpin, starlitNextPhase, type StarlitPhase } from "./starlit-emerge";

const CharacterGlbStage = dynamic(
  () => import("./character-glb-stage").then((mod) => mod.CharacterGlbStage),
  { ssr: false }
);

const StarlitEmergeStage = dynamic(
  () => import("./starlit-emerge-stage").then((mod) => mod.StarlitEmergeStage),
  { ssr: false }
);

function usePopoutInteraction() {
  const [state, setState] = useState<PopoutInteractionState>(createPopoutInteractionState);

  const activate = useCallback((options?: { force?: boolean }) => {
    setState((current) =>
      activatePopout(current, {
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        force: options?.force === true
      })
    );
  }, []);

  return {
    state,
    activate,
    onReady: () => setState((current) => markPopoutReady(current)),
    onFallback: () => setState((current) => markPopoutFailed(current)),
    onSpinDone: () => setState((current) => settlePopout(current))
  };
}

function usePopoutSpinRequest(spinRequestId: number, activate: (options?: { force?: boolean }) => void) {
  const handledRef = useRef(0);
  useEffect(() => {
    if (spinRequestId <= 0 || handledRef.current === spinRequestId) return;
    handledRef.current = spinRequestId;
    activate({ force: true });
  }, [activate, spinRequestId]);
}

export function DrawingScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [starlit, setStarlit] = useState<StarlitPhase>("hidden");
  const [heroSpinId, setHeroSpinId] = useState(0);

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
      data-starlit={starlit}
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
          spinRequestId={heroSpinId}
        />
        {starlit === "hidden" ? (
          <button
            type="button"
            className="detective-hero__reveal"
            aria-label="Arată obiectul găsit în 3D"
            onClick={() => setStarlit((current) => starlitNextPhase(current, "photo"))}
          />
        ) : null}
      </div>
      {starlit !== "hidden" ? (
        <div className="starlit-emerge">
          <span className="starlit-emerge__glow" aria-hidden="true" />
          <StarlitEmergeStage
            phase={starlit}
            onOut={() => setStarlit("out")}
            onHidden={() => setStarlit("hidden")}
          />
        </div>
      ) : null}
      {starlit === "out" ? (
        <>
          <button
            type="button"
            className="detective-hero__hero-hit"
            aria-label="Ridică și învârte detectivul galben"
            onClick={() => {
              if (shouldHeroSpin(starlit)) setHeroSpinId((current) => current + 1);
            }}
          />
          <button
            type="button"
            className="detective-hero__return"
            aria-label="Trimite obiectul înapoi în poză"
            onClick={() => {
              if (starlitNextPhase(starlit, "scene") === "returning") setStarlit("returning");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function DetectiveCharacter({
  src,
  demo,
  className = "",
  celebrationId = 0,
  spinRequestId = 0
}: {
  src: StaticImageData;
  demo: HomepageCharacterDemo;
  className?: string;
  celebrationId?: number;
  spinRequestId?: number;
}) {
  const { state, activate, onReady, onFallback, onSpinDone } = usePopoutInteraction();
  const active = state.phase === "playing" || state.phase === "loading";

  useEffect(() => {
    if (celebrationId > 0) activate();
  }, [activate, celebrationId]);

  usePopoutSpinRequest(spinRequestId, activate);

  return (
    <div
      className={`detective-character ${className}`}
      data-phase={popoutDisplayPhase(state)}
      data-reveal={state.reveal}
      data-character={demo.id}
      onPointerEnter={() => activate()}
      onClick={() => activate()}
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

/** The found-rooster moment, shown as a single framed illustration. */
export function LandingDiscovery() {
  return (
    <div className="landing-discovery" aria-hidden="true">
      <div className="landing-discovery__glow" />
      <div className="landing-discovery__frame">
        <Image
          className="landing-discovery__image"
          src={auGasitCocosul}
          alt=""
          width={1024}
          height={1024}
          sizes="(max-width: 899px) 92vw, 620px"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        <div className="landing-discovery__shine" />
      </div>
    </div>
  );
}

export function LandingRooster() {
  const [celebrationId, setCelebrationId] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const celebrate = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setCelebrationId((current) => current + 1);
    setCelebrating(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCelebrating(false);
      timerRef.current = null;
    }, 3600);
  };

  return (
    <div className="landing-rooster" data-celebrating={celebrating ? "true" : "false"}>
      <CelebrationFireworks celebrationId={celebrationId} />
      <div className="detective-companions">
        <DetectiveCharacter
          src={detectiveRedHairedBoy}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectiveRedHairedBoy}
          className="detective-character--red"
          celebrationId={celebrationId}
        />
        <DetectiveCharacter
          src={detectivePurpleGirl}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectivePurpleGirl}
          className="detective-character--purple"
          celebrationId={celebrationId}
        />
        <DetectiveCharacter
          src={detectiveCurlyBoy}
          demo={HOMEPAGE_DEMO_CHARACTERS.detectiveCurlyBoy}
          className="detective-character--curly"
          celebrationId={celebrationId}
        />
      </div>
      <CharacterPaperCard
        src={rooster}
        variant="rooster"
        sizes="200px"
        demo={HOMEPAGE_DEMO_CHARACTERS.rooster}
        stageClassName="landing-rooster__stage"
        canvasClassName="landing-rooster__canvas"
        onClickExtra={celebrate}
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
  canvasClassName,
  onClickExtra
}: {
  src: StaticImageData;
  variant: PopoutVariant;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  demo: HomepageCharacterDemo;
  stageClassName?: string;
  canvasClassName?: string;
  onClickExtra?: () => void;
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
      onClickActivate={() => {
        activate();
        onClickExtra?.();
      }}
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

const FIREWORK_BURSTS = [
  { left: "12%", top: "18%", delay: "0s" },
  { left: "32%", top: "30%", delay: "0.18s" },
  { left: "52%", top: "14%", delay: "0.08s" },
  { left: "72%", top: "28%", delay: "0.28s" },
  { left: "90%", top: "16%", delay: "0.14s" }
] as const;

function CelebrationFireworks({ celebrationId }: { celebrationId: number }) {
  if (celebrationId <= 0) return null;
  return (
    <div className="celebration-fireworks" key={celebrationId} aria-hidden="true">
      {FIREWORK_BURSTS.map((burst, burstIndex) => (
        <div
          className="celebration-firework"
          key={`${burst.left}-${burst.top}`}
          style={
            {
              "--firework-left": burst.left,
              "--firework-top": burst.top,
              "--firework-delay": burst.delay
            } as CSSProperties
          }
        >
          {Array.from({ length: 16 }, (_, particleIndex) => (
            <i
              key={particleIndex}
              style={
                {
                  "--particle-angle": `${particleIndex * 22.5}deg`,
                  "--particle-distance": `${82 + (particleIndex % 4) * 18}px`,
                  "--particle-color": `hsl(${(burstIndex * 72 + particleIndex * 17) % 360} 92% 66%)`
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
