"use client";

import { useEffect, useRef } from "react";
import type { StaticImageData } from "next/image";
import heroRedDress from "./art/hero-red-dress.png";
import childOpenArms from "./art/child-open-arms.png";
import childGreenShirt from "./art/child-green-shirt.png";
import rooster from "./art/rooster.png";
import { CharacterPopout, type PopoutVariant } from "./character-popout";

/**
 * Paper-card illustrations. The source PNGs are opaque RGB, so the white
 * field stays as the card surface. Motion is CSS only; this effect adds
 * desktop pointer parallax and pauses idle motion while the tab is hidden.
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
        />
        <CharacterPaperCard
          src={childOpenArms}
          variant="open-arms"
          sizes="(max-width: 899px) 140px, 160px"
          loading="eager"
        />
        <CharacterPaperCard
          src={childGreenShirt}
          variant="green-shirt"
          sizes="(max-width: 899px) 140px, 160px"
          loading="eager"
        />
      </div>
    </div>
  );
}

export function LandingRooster() {
  return (
    <div className="landing-rooster">
      <CharacterPopout variant="rooster" src={rooster} sizes="200px" />
    </div>
  );
}

function CharacterPaperCard({
  src,
  variant,
  sizes,
  priority = false,
  loading
}: {
  src: StaticImageData;
  variant: PopoutVariant;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
}) {
  return (
    <CharacterPopout
      variant={variant}
      src={src}
      sizes={sizes}
      priority={priority}
      loading={loading}
    />
  );
}
