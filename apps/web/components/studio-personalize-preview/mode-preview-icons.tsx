"use client";

import dynamic from "next/dynamic";
import type { TransformModeId } from "./fixtures";

const ModePopoutThumb = dynamic(
  () => import("./mode-popout-thumb").then((mod) => mod.ModePopoutThumb),
  { ssr: false }
);

/** Approved local demos for Personaj → Cum apare thumbs. */
export const MODE_PREVIEW_ASSETS = {
  /** Pre-cut drawing — extruded with the same Studio pop-out pipeline. */
  popoutDrawing: "/demo/studio/mode-popout-drawing.png",
  /** Still render of the figurine demo. The source GLB stays out of Git. */
  figurine: "/demo/studio/mode-figurine.webp"
} as const;

/** @deprecated Prefer MODE_PREVIEW_ASSETS. Kept for older imports. */
export const MODE_PREVIEW_GLB = {
  popout: MODE_PREVIEW_ASSETS.popoutDrawing,
  figurine: MODE_PREVIEW_ASSETS.figurine
} as const;

/** Decorative mode thumbs for Personaj → Cum apare. Not interactive. */
export function ModePreviewIcon({ mode }: { mode: TransformModeId }) {
  if (mode === "figurine" || mode === "import") {
    return (
      <span className={`studio-ws__mode-icon studio-ws__mode-icon--${mode}`}>
        <span className="studio-ws__mode-icon-float" aria-hidden="true">
          <img src={MODE_PREVIEW_ASSETS.figurine} alt="" aria-hidden="true" />
        </span>
        <span className="studio-ws__mode-icon-shadow" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="studio-ws__mode-icon studio-ws__mode-icon--popout">
      <span className="studio-ws__mode-paper" aria-hidden="true" />
      <ModePopoutThumb imageUrl={MODE_PREVIEW_ASSETS.popoutDrawing} />
    </span>
  );
}
