"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/** Local demo chase film for the Studio atelier hero. */
export const STUDIO_HERO_FILM = {
  src: "/demo/studio/rooster-chase.mp4",
  poster: "/demo/studio/rooster-chase-poster.webp"
} as const;

export function HeroStageFilm() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <div className="atelier-film">
      {reduceMotion ? (
        <Image
          className="atelier-film__media"
          src={STUDIO_HERO_FILM.poster}
          alt=""
          fill
          sizes="(max-width: 980px) 92vw, 560px"
          draggable={false}
        />
      ) : (
        <video
          className="atelier-film__media"
          src={STUDIO_HERO_FILM.src}
          poster={STUDIO_HERO_FILM.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}
