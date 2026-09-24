"use client";

import { useEffect, useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import heroRedDress from "./art/hero-red-dress.png";
import childOpenArms from "./art/child-open-arms.png";
import childGreenShirt from "./art/child-green-shirt.png";
import rooster from "./art/rooster.png";

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
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.classList.remove("can-parallax");
    };
  }, []);

  return (
    <div className="kidar-scene" ref={rootRef} aria-hidden="true">
      <div className="kidar-scene__shift">
        <PaperCard
          src={heroRedDress}
          className="kidar-card kidar-card--hero"
          sizes="(max-width: 899px) 168px, 240px"
          priority
        />
        <PaperCard
          src={childOpenArms}
          className="kidar-card kidar-card--arms"
          sizes="(max-width: 899px) 104px, 140px"
          loading="eager"
        />
        <PaperCard
          src={childGreenShirt}
          className="kidar-card kidar-card--green"
          sizes="(max-width: 899px) 104px, 140px"
          loading="eager"
        />
      </div>
    </div>
  );
}

export function LandingRooster() {
  return (
    <div className="landing-rooster" aria-hidden="true">
      <PaperCard src={rooster} className="kidar-card kidar-card--rooster" sizes="200px" />
    </div>
  );
}

function PaperCard({
  src,
  className,
  sizes,
  priority = false,
  loading
}: {
  src: StaticImageData;
  className: string;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
}) {
  return (
    <figure className={className}>
      <div className="kidar-card__lift">
        <Image
          src={src}
          alt=""
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : loading}
          className="kidar-card__img"
        />
      </div>
    </figure>
  );
}
