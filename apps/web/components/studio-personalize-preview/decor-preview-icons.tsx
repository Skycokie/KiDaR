"use client";

import dynamic from "next/dynamic";
import type { DecorId } from "./fixtures";
import { DECOR_GLB_SRC, decorGlbAvailable } from "./decor-assets";

const ModeGlbThumb = dynamic(
  () => import("./mode-glb-thumb").then((mod) => mod.ModeGlbThumb),
  { ssr: false }
);

/** Live GLB thumb for Studio → Decor (float preview; clicks go to the card). */
export function DecorPreviewIcon({ decorId }: { decorId: DecorId }) {
  if (!decorGlbAvailable(decorId)) {
    return (
      <span className={`studio-ws__asset-icon studio-ws__asset-icon--${decorId} studio-ws__asset-icon--pending`} />
    );
  }
  return (
    <span className={`studio-ws__asset-icon studio-ws__asset-icon--${decorId} studio-ws__asset-icon--glb`}>
      <ModeGlbThumb modelUrl={DECOR_GLB_SRC[decorId]} variant="figurine" interactive={false} />
    </span>
  );
}

export { DECOR_GLB_SRC, decorGlbAvailable };
