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
  /**
   * Optional local figurine GLB path. Not bundled in Git until compressed/CDN-approved.
   * The UI uses the CSS figurine placeholder so deploys do not depend on WHO.glb.
   */
  figurine: "/demo/glb/WHO.glb"
} as const;

/** @deprecated Prefer MODE_PREVIEW_ASSETS. Kept for older imports. */
export const MODE_PREVIEW_GLB = {
  popout: MODE_PREVIEW_ASSETS.popoutDrawing,
  figurine: MODE_PREVIEW_ASSETS.figurine
} as const;

/** Decorative mode thumbs for Personaj → Cum apare. Not interactive. */
export function ModePreviewIcon({ mode }: { mode: TransformModeId }) {
  if (mode === "figurine") {
    return (
      <span className="studio-ws__mode-icon studio-ws__mode-icon--figurine">
        <span className="studio-ws__mode-icon-float" aria-hidden="true" />
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
