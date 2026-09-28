/** Starting-point cards use approved story stills. The photo-drop paper stays local SVG. */

import Image from "next/image";
import { STARTING_POINT_ART, type StartingPointArtKind } from "./art-assets";

export { STARTING_POINT_ART, type StartingPointArtKind } from "./art-assets";

type ArtKind = StartingPointArtKind | "paper";

const STARTING_POINT_SIZES = "(max-width: 768px) 92vw, (max-width: 1280px) 30vw, 360px";

export function CreazaArt({ kind }: { kind: ArtKind }) {
  if (kind === "paper") {
    return (
      <svg viewBox="0 0 240 300" className="creaza-art" aria-hidden="true">
        <path
          d="M20 24 L210 18 L226 270 L34 286 Z"
          fill="#fff8ec"
          stroke="#d7c7a8"
          strokeWidth="1.2"
        />
        <path
          d="M70 120 C90 80 140 70 170 100 C190 120 200 110 210 95"
          fill="none"
          stroke="#2a241c"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="108" cy="108" r="3" fill="#2a241c" />
        <ellipse cx="120" cy="150" rx="36" ry="22" fill="#e36b4e" opacity="0.22" />
      </svg>
    );
  }

  const art = STARTING_POINT_ART[kind];
  return (
    <Image
      src={art.src}
      alt=""
      fill
      sizes={STARTING_POINT_SIZES}
      className="creaza-art"
      draggable={false}
    />
  );
}
