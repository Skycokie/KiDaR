"use client";

import { useEffect, useRef } from "react";

/**
 * Original paper-to-figurine scene. SVG only: no model files, no WebGL.
 * Scroll depth is CSS. This component only adds desktop pointer parallax
 * and pauses idle motion while the tab is hidden.
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
      <svg className="kidar-scene__svg" viewBox="0 0 360 420" role="presentation">
        <defs>
          <linearGradient id="kidar-paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffdf8" />
            <stop offset="1" stopColor="#f3eadc" />
          </linearGradient>
          <radialGradient id="kidar-wash" cx="50%" cy="38%" r="55%">
            <stop offset="0" stopColor="#efe9ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#efe9ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect className="kidar-scene__sheet" x="48" y="36" width="264" height="328" rx="28" fill="url(#kidar-paper)" />
        <rect x="48" y="36" width="264" height="328" rx="28" fill="url(#kidar-wash)" />

        <g className="kidar-scene__shadow">
          <ellipse cx="180" cy="318" rx="78" ry="16" fill="#d9d0ea" />
        </g>

        <g className="kidar-scene__volume">
          <path
            d="M132 168c8 62 18 108 48 124 30-16 42-64 50-124-22 16-48 24-98 0z"
            fill="#3a3480"
          />
          <circle cx="196" cy="132" r="52" fill="#3a3480" />
          <path d="M168 292h52l10 28H158z" fill="#cfc6e4" />
        </g>

        <g className="kidar-scene__pencil">
          <circle cx="168" cy="124" r="50" />
          <path d="M118 176c10 58 22 102 50 116 28-14 40-60 50-116-24 18-52 26-100 0z" />
          <path d="M132 168c18 8 36 8 54-2" />
          <path d="M196 86l8-22 8 18 20 4-16 12 6 18-18-10-16 8 4-20z" />
        </g>

        <g className="kidar-scene__shift">
          <g className="kidar-scene__fill">
            <path
              d="M118 176c10 58 22 102 50 116 28-14 40-60 50-116-24 18-52 26-100 0z"
              fill="#6a62e4"
            />
            <ellipse cx="168" cy="214" rx="28" ry="34" fill="#9d97f0" />
            <circle cx="168" cy="124" r="50" fill="#f6d8bf" />
            <circle cx="150" cy="132" r="7" fill="#f3a0b4" />
            <circle cx="188" cy="130" r="7" fill="#f3a0b4" />
            <circle cx="158" cy="122" r="4.2" fill="#241f33" />
            <circle cx="180" cy="122" r="4.2" fill="#241f33" />
            <path d="M156 140c8 8 18 8 26 0" fill="none" stroke="#241f33" strokeWidth="3" strokeLinecap="round" />
            <path d="M112 196c-16 8-22 22-14 30 10-12 22-16 34-12" fill="#6a62e4" />
            <path d="M214 188c18 2 28 16 24 28-12-8-24-10-38-6" fill="#6a62e4" />
            <ellipse cx="150" cy="292" rx="16" ry="10" fill="#4f47b8" />
            <ellipse cx="190" cy="292" rx="16" ry="10" fill="#4f47b8" />
          </g>
          <g className="kidar-scene__ink">
            <circle cx="168" cy="124" r="50" />
            <path d="M118 176c10 58 22 102 50 116 28-14 40-60 50-116-24 18-52 26-100 0z" />
            <path d="M112 196c-16 8-22 22-14 30" />
            <path d="M214 188c18 2 28 16 24 28" />
          </g>
          <g className="kidar-scene__star">
            <path
              d="M196 78l7-20 7 16 18 4-14 11 5 16-16-9-14 8 4-18z"
              fill="#f2c14e"
              stroke="#241f33"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </g>
        </g>

        <g className="kidar-scene__spark">
          <circle cx="96" cy="96" r="3" fill="#5b4fe0" />
          <circle cx="276" cy="118" r="2.4" fill="#e7a15a" />
          <circle cx="286" cy="250" r="2" fill="#5b4fe0" />
        </g>
      </svg>
    </div>
  );
}
