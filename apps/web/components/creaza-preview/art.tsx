/** Lightweight SVG art for creaza-preview — no network. */

type ArtKind = "whale" | "garden" | "kite" | "paper";

export function CreazaArt({ kind }: { kind: ArtKind }) {
  switch (kind) {
    case "whale":
      return (
        <svg viewBox="0 0 280 200" className="creaza-art" aria-hidden="true">
          <rect width="280" height="200" fill="#efe6d4" />
          <path
            d="M36 118 C70 70 140 58 186 86 C214 104 232 96 250 78 C236 112 214 134 176 142 C128 152 74 158 44 138 C30 130 28 124 36 118 Z"
            fill="none"
            stroke="#2c3d55"
            strokeWidth="2.2"
          />
          <circle cx="92" cy="104" r="3" fill="#2c3d55" />
        </svg>
      );
    case "garden":
      return (
        <svg viewBox="0 0 280 200" className="creaza-art" aria-hidden="true">
          <rect width="280" height="200" fill="#e7ddc6" />
          <ellipse cx="90" cy="78" rx="28" ry="22" fill="#6d8f4e" />
          <ellipse cx="170" cy="90" rx="36" ry="28" fill="#4f7a46" />
          <ellipse cx="230" cy="108" rx="22" ry="18" fill="#7ea45a" />
        </svg>
      );
    case "kite":
      return (
        <svg viewBox="0 0 280 200" className="creaza-art" aria-hidden="true">
          <rect width="280" height="200" fill="#f3ead4" />
          <path d="M100 40 L180 80 L140 150 L60 110 Z" fill="#e36b4e" />
          <path d="M140 150 C155 170 175 185 200 195" fill="none" stroke="#6b4b2a" strokeWidth="1.5" />
        </svg>
      );
    case "paper":
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
}
