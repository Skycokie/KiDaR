"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Local demo chase film for the Studio atelier hero. */
export const STUDIO_HERO_FILM = {
  src: "/demo/studio/rooster-chase.mp4",
  poster: "/demo/studio/rooster-chase-poster.webp"
} as const;

type HeroStageFilmProps = {
  playLabel: string;
  pauseLabel: string;
};

/**
 * Atelier hero film. Autoplays when allowed; with Reduce Motion or blocked
 * autoplay, tapping the frame plays/pauses (no visible button).
 */
export function HeroStageFilm({ playLabel, pauseLabel }: HeroStageFilmProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [videoNeedsTap, setVideoNeedsTap] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const next = media.matches;
      setReducedMotion(next);
      if (!next) setPlaying(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Under Reduce Motion, play() must stay inside the tap handler (user gesture).
    if (reducedMotion) {
      if (!playing) video.pause();
      return;
    }
    const attempt = video.play();
    if (attempt) {
      attempt
        .then(() => setVideoNeedsTap(false))
        .catch(() => setVideoNeedsTap(true));
    }
  }, [reducedMotion, playing]);

  const motionOn = !reducedMotion || playing;
  const showPoster = !motionOn;
  const interactive = reducedMotion || videoNeedsTap;
  const announcedPlaying = reducedMotion ? playing : !videoNeedsTap;

  const onPlayToggle = () => {
    const video = videoRef.current;
    if (reducedMotion) {
      if (playing) {
        video?.pause();
        setPlaying(false);
        return;
      }
      setPlaying(true);
      setVideoNeedsTap(false);
      void video?.play().catch(() => setVideoNeedsTap(true));
      return;
    }
    if (!video) return;
    if (video.paused || videoNeedsTap) {
      setVideoNeedsTap(false);
      void video.play().catch(() => setVideoNeedsTap(true));
      return;
    }
    video.pause();
    setVideoNeedsTap(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPlayToggle();
    }
  };

  return (
    <div
      className={`atelier-film${interactive ? " atelier-film--interactive" : ""}`}
      data-playing={motionOn ? "true" : "false"}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? (announcedPlaying ? pauseLabel : playLabel) : undefined}
      aria-pressed={interactive ? announcedPlaying : undefined}
      onClick={interactive ? onPlayToggle : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
    >
      <video
        ref={videoRef}
        className="atelier-film__media"
        data-active={motionOn ? "true" : "false"}
        src={STUDIO_HERO_FILM.src}
        poster={STUDIO_HERO_FILM.poster}
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      {showPoster ? (
        // eslint-disable-next-line @next/next/no-img-element -- static public poster overlay
        <img
          className="atelier-film__poster"
          src={STUDIO_HERO_FILM.poster}
          alt=""
          draggable={false}
        />
      ) : null}
    </div>
  );
}
