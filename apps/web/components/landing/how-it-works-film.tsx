"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Real film in `public/demo/landing/`; SVG loop is only a missing-file fallback. */
export const HOW_IT_WORKS_FILM = {
  mp4: "/demo/landing/how-it-works.mp4",
  webm: "/demo/landing/how-it-works.webm",
  poster: "/demo/landing/how-it-works-poster.webp"
} as const;

export type HowItWorksStep = {
  title: string;
  body: string;
};

type HowItWorksFilmProps = {
  steps: readonly [HowItWorksStep, HowItWorksStep, HowItWorksStep];
  playLabel: string;
  pauseLabel: string;
};

/**
 * Closing explainer: photograph → upload → QR for 3D AR.
 * Prefers the shipped WebM/MP4; falls back to a short SVG loop if the film is missing.
 */
export function HowItWorksFilm({ steps, playLabel, pauseLabel }: HowItWorksFilmProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasFilm, setHasFilm] = useState(true);
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
    let cancelled = false;
    fetch(HOW_IT_WORKS_FILM.webm, { method: "HEAD" })
      .then((response) => {
        if (!cancelled) setHasFilm(response.ok);
      })
      .catch(() => {
        if (!cancelled) setHasFilm(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasFilm) return;
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
  }, [hasFilm, reducedMotion, playing]);

  const motionOn = !reducedMotion || playing;
  const showPoster = hasFilm && !motionOn;
  const interactive = reducedMotion || (hasFilm && videoNeedsTap);
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
    if (hasFilm && video) {
      if (video.paused || videoNeedsTap) {
        setVideoNeedsTap(false);
        void video.play().catch(() => setVideoNeedsTap(true));
        return;
      }
      video.pause();
      setVideoNeedsTap(true);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPlayToggle();
    }
  };

  return (
    <div className="how-film">
      <div
        className={`how-film__frame${interactive ? " how-film__frame--interactive" : ""}`}
        data-playing={motionOn ? "true" : "false"}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? (announcedPlaying ? pauseLabel : playLabel) : undefined}
        aria-pressed={interactive ? announcedPlaying : undefined}
        onClick={interactive ? onPlayToggle : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
      >
        {hasFilm ? (
          <video
            ref={videoRef}
            className="how-film__media"
            data-active={motionOn ? "true" : "false"}
            poster={HOW_IT_WORKS_FILM.poster}
            autoPlay={!reducedMotion}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={HOW_IT_WORKS_FILM.webm} type="video/webm" />
            <source src={HOW_IT_WORKS_FILM.mp4} type="video/mp4" />
          </video>
        ) : null}
        {showPoster ? (
          // Dynamic public path; next/image is unnecessary for a single static poster.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="how-film__poster" src={HOW_IT_WORKS_FILM.poster} alt="" draggable={false} />
        ) : null}
        {!hasFilm ? <HowItWorksSvg playing={motionOn} /> : null}
      </div>
      <ol className="how-film__steps">
        {steps.map((step, index) => (
          <li className="how-film__step" key={step.title}>
            <span className="how-film__step-n" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HowItWorksSvg({ playing }: { playing: boolean }) {
  return (
    <svg
      className="how-film__svg"
      viewBox="0 0 1600 900"
      role="img"
      aria-hidden="true"
      data-playing={playing ? "true" : "false"}
    >
      <defs>
        <radialGradient id="how-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#9b6fd6" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#0d1017" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="how-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2a1c" />
          <stop offset="100%" stopColor="#24180f" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="#0d1017" />
      <rect width="1600" height="900" fill="url(#how-glow)" />
      <g className="how-film__table">
        <ellipse cx="800" cy="720" rx="520" ry="70" fill="url(#how-table)" opacity="0.9" />
      </g>
      <g className="how-film__beat how-film__beat--photo">
        <rect x="560" y="430" width="280" height="220" rx="18" fill="#f3efe6" />
        <path d="M610 580 L660 500 L710 580 Z" fill="#e8964a" />
        <circle cx="760" cy="520" r="36" fill="#8fbf5a" />
        <ellipse cx="800" cy="575" rx="22" ry="14" fill="#d64545" />
        <rect x="980" y="280" width="180" height="320" rx="28" fill="#1a1f2a" stroke="#5cc8d6" strokeWidth="6" />
        <rect x="1000" y="310" width="140" height="220" rx="12" fill="#f3efe6" />
        <circle className="how-film__flash" cx="1070" cy="420" r="90" fill="#fff8e7" opacity="0" />
      </g>
      <g className="how-film__beat how-film__beat--upload">
        <ellipse cx="800" cy="260" rx="160" ry="70" fill="#2a3344" />
        <path
          d="M800 220 L800 340 M760 280 L800 340 L840 280"
          fill="none"
          stroke="#5cc8d6"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="700" y="420" width="200" height="150" rx="14" fill="#f3efe6" />
        <ellipse cx="800" cy="560" rx="36" ry="22" fill="#d64545" opacity="0.85" />
      </g>
      <g className="how-film__beat how-film__beat--qr">
        <rect x="470" y="360" width="200" height="200" rx="18" fill="#f3efe6" />
        <rect x="495" y="385" width="50" height="50" fill="#0d1017" />
        <rect x="595" y="385" width="50" height="50" fill="#0d1017" />
        <rect x="495" y="485" width="50" height="50" fill="#0d1017" />
        <rect x="920" y="300" width="170" height="300" rx="26" fill="#1a1f2a" stroke="#9b6fd6" strokeWidth="6" />
        <ellipse className="how-film__ar-rooster" cx="1005" cy="470" rx="40" ry="24" fill="#d64545" />
        <circle cx="1038" cy="455" r="16" fill="#e8c54a" />
      </g>
    </svg>
  );
}
