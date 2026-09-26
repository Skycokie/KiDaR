/** Preset cards use Meshy stills. The photo-drop paper stays local SVG. */

type ArtKind = "whale" | "garden" | "kite" | "paper";

const PRESET_ART: Record<Exclude<ArtKind, "paper">, { src: string; width: number; height: number }> = {
  whale: { src: "/demo/creaza/coloring-whale.jpg", width: 1024, height: 1024 },
  garden: { src: "/demo/creaza/story-gate.jpg", width: 1376, height: 768 },
  kite: { src: "/demo/creaza/mission-key.jpg", width: 1024, height: 1024 }
};

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

  const art = PRESET_ART[kind];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public stills for preset cards
    <img
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      className="creaza-art"
      draggable={false}
    />
  );
}
