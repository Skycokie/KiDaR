type ArtId = "aurora" | "garden" | "kite" | "whale" | "fox" | "dragon" | "chime" | "sticker";

export function Artwork({ id, kind }: { id: string; kind: ArtId }) {
  switch (kind) {
    case "aurora":
      return <Aurora />;
    case "garden":
      return <Garden />;
    case "kite":
      return <Kite />;
    case "whale":
      return <Whale />;
    case "fox":
      return <Fox />;
    case "dragon":
      return <Dragon />;
    case "chime":
      return <Chime />;
    case "sticker":
      return <Sticker />;
  }
}

function Aurora() {
  return (
    <svg viewBox="0 0 240 320" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="320" fill="#1a1630" />
      <path d="M0 220 C40 160 90 140 140 170 C180 192 210 150 240 120 V320 H0 Z" fill="#2a3d6e" />
      <path d="M0 80 C50 40 90 90 140 50 C180 20 210 70 240 40 V0 H0 Z" fill="#5b3d8c" opacity="0.75" />
      <path
        d="M48 210 C70 150 110 120 150 132 C188 144 200 110 214 92 C190 118 176 160 148 178 C112 202 78 228 48 210 Z"
        fill="none"
        stroke="#f2e6c9"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M150 132 C168 108 186 96 206 88" fill="none" stroke="#f2e6c9" strokeWidth="1.6" />
      <circle cx="168" cy="128" r="2.4" fill="#f2e6c9" />
      <path d="M20 40 l8 14 M210 60 l6 12 M40 280 l10 8" stroke="#e8c07a" strokeWidth="1.2" />
    </svg>
  );
}

function Garden() {
  return (
    <svg viewBox="0 0 360 200" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="360" height="200" fill="#e7ddc6" />
      <rect x="0" y="128" width="360" height="72" fill="#c5d4b0" />
      <path d="M40 160 C40 90 90 80 90 160" fill="none" stroke="#3c5a3a" strokeWidth="2" />
      <ellipse cx="90" cy="78" rx="28" ry="22" fill="#6d8f4e" />
      <path d="M150 168 C150 100 210 92 210 168" fill="none" stroke="#3c5a3a" strokeWidth="2" />
      <ellipse cx="210" cy="86" rx="36" ry="28" fill="#4f7a46" />
      <path d="M270 170 C276 120 320 118 328 168" fill="none" stroke="#3c5a3a" strokeWidth="2" />
      <ellipse cx="322" cy="108" rx="22" ry="18" fill="#7ea45a" />
      <path
        d="M16 188 C80 176 140 192 220 180 C280 172 330 186 352 178"
        fill="none"
        stroke="#6b4b2a"
        strokeWidth="1.4"
      />
      <circle cx="118" cy="148" r="4" fill="#c45b4a" />
      <circle cx="248" cy="154" r="3.4" fill="#d07a3a" />
    </svg>
  );
}

function Kite() {
  return (
    <svg viewBox="0 0 240 240" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="240" fill="#f3ead4" />
      <path d="M0 170 L240 130 V240 H0 Z" fill="#87b5d6" opacity="0.45" />
      <path d="M86 54 L154 86 L118 154 L50 122 Z" fill="#e36b4e" />
      <path d="M86 54 L118 154" stroke="#f3ead4" strokeWidth="1.6" />
      <path d="M154 86 L50 122" stroke="#f3ead4" strokeWidth="1.6" />
      <path d="M118 154 C130 176 146 196 168 214" fill="none" stroke="#6b4b2a" strokeWidth="1.5" />
      <path d="M136 178 l10 4 M148 194 l10 4" stroke="#e36b4e" strokeWidth="2" />
    </svg>
  );
}

function Whale() {
  return (
    <svg viewBox="0 0 280 200" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="280" height="200" fill="#efe6d4" />
      <path
        d="M36 118 C70 70 140 58 186 86 C214 104 232 96 250 78 C236 112 214 134 176 142 C128 152 74 158 44 138 C30 130 28 124 36 118 Z"
        fill="none"
        stroke="#2c3d55"
        strokeWidth="2.2"
      />
      <circle cx="92" cy="104" r="3" fill="#2c3d55" />
      <path d="M186 86 C200 70 214 64 228 62" fill="none" stroke="#2c3d55" strokeWidth="1.6" />
      <path d="M24 160 C80 148 140 168 210 152" fill="none" stroke="#b08968" strokeWidth="1.2" />
    </svg>
  );
}

function Fox() {
  return (
    <svg viewBox="0 0 180 220" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="180" height="220" fill="#f0d8c0" />
      <path d="M50 86 L90 40 L130 86 L118 170 L62 170 Z" fill="#d06a32" />
      <path d="M50 86 L68 40 L78 90 Z" fill="#3b2a22" />
      <path d="M130 86 L112 40 L102 90 Z" fill="#3b2a22" />
      <circle cx="78" cy="102" r="4" fill="#1b1726" />
      <circle cx="104" cy="102" r="4" fill="#1b1726" />
      <path d="M84 124 C90 132 96 132 102 124" fill="none" stroke="#1b1726" strokeWidth="1.6" />
    </svg>
  );
}

function Dragon() {
  return (
    <svg viewBox="0 0 180 280" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="180" height="280" fill="#ead7b8" />
      <path
        d="M40 200 C48 140 86 108 118 120 C146 130 150 96 160 74 C142 104 136 148 112 168 C80 196 52 220 40 200 Z"
        fill="#5d4fe0"
        opacity="0.88"
      />
      <path d="M118 120 C132 96 148 86 164 80" fill="none" stroke="#2b2148" strokeWidth="1.8" />
      <circle cx="128" cy="118" r="3" fill="#f4ead7" />
    </svg>
  );
}

function Chime() {
  return (
    <svg viewBox="0 0 260 140" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="260" height="140" fill="#d9c7a6" />
      <path
        d="M24 92 C60 40 110 40 148 88 C176 124 214 118 240 78"
        fill="none"
        stroke="#5b4630"
        strokeWidth="2.4"
      />
      <circle cx="72" cy="58" r="7" fill="#e8d7a8" stroke="#5b4630" strokeWidth="1.4" />
      <circle cx="168" cy="96" r="5" fill="#e8d7a8" stroke="#5b4630" strokeWidth="1.4" />
    </svg>
  );
}

function Sticker() {
  return (
    <svg viewBox="0 0 180 180" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="180" height="180" fill="#f6efe2" />
      <rect
        x="28"
        y="28"
        width="124"
        height="124"
        rx="18"
        fill="#fff8ee"
        stroke="#c9b496"
        strokeWidth="2"
        strokeDasharray="6 5"
      />
      <text x="90" y="102" textAnchor="middle" fontSize="42" fill="#5b4fe0" fontFamily="Georgia, serif">
        A
      </text>
    </svg>
  );
}

/** Hero: cream sketch paper — thick pencil dragon, color splash, folded corner. */
function HeroPaper() {
  return (
    <svg viewBox="0 0 280 340" className="studio-art" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {/* imperfect cream sheet */}
      <path
        d="M18 28 C22 14 48 10 72 12 L248 22 C264 24 272 38 270 54 L258 300 C256 318 238 330 218 328 L42 308 C24 304 14 288 16 270 Z"
        fill="#f6ecd8"
      />
      <path
        d="M24 36 C28 22 52 18 74 20 L244 30 C258 32 264 44 262 58 L252 292 C250 308 236 318 220 316 L48 298 C30 294 22 280 24 264 Z"
        fill="#fff8ec"
        opacity="0.55"
      />
      {/* folded / torn corner */}
      <path d="M218 328 L258 300 L248 328 Z" fill="#e2d2b4" />
      <path d="M218 328 L248 328 L238 312 Z" fill="#cbb896" opacity="0.85" />
      {/* lively color splash under the drawing */}
      <ellipse cx="118" cy="168" rx="54" ry="38" fill="#e36b4e" opacity="0.28" />
      <ellipse cx="168" cy="148" rx="28" ry="22" fill="#5b4fe0" opacity="0.22" />
      {/* thick marker / pencil dragon sketch — head + body readable as character */}
      <g fill="none" stroke="#2a241c" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M58 228 C52 176 78 132 118 118 C148 108 168 128 172 156 C176 186 156 214 124 228 C96 240 66 246 58 228 Z"
          strokeWidth="3.4"
        />
        <path d="M118 118 C132 86 156 68 186 62" strokeWidth="2.6" />
        <path d="M172 156 C198 148 218 136 232 118" strokeWidth="2.4" />
        <path d="M148 98 L158 72 L168 100" strokeWidth="2.2" />
        <path d="M92 198 C104 186 122 184 136 194" strokeWidth="2" />
        <path d="M78 236 l6 16 M96 240 l5 14" strokeWidth="2.2" />
      </g>
      <circle cx="138" cy="142" r="3.6" fill="#2a241c" />
      <path
        d="M186 72 C198 64 212 62 224 66"
        fill="none"
        stroke="#e36b4e"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="198" cy="128" r="8" fill="#5b4fe0" opacity="0.5" />
      <ellipse cx="112" cy="176" rx="22" ry="16" fill="#e36b4e" opacity="0.22" />
    </svg>
  );
}

/** Hero: stylized sculptural dragon lifting off the page — no card frame. */
function HeroEmergence() {
  return (
    <svg viewBox="0 0 200 240" className="studio-art studio-art--emergence" aria-hidden="true">
      <defs>
        <linearGradient id="hero-emerge-body" x1="0.15" y1="0.1" x2="0.9" y2="0.95">
          <stop offset="0%" stopColor="#8b7cf5" />
          <stop offset="45%" stopColor="#5b4fe0" />
          <stop offset="100%" stopColor="#2f2868" />
        </linearGradient>
        <linearGradient id="hero-emerge-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0b27a" />
          <stop offset="100%" stopColor="#e36b4e" />
        </linearGradient>
      </defs>
      <ellipse cx="96" cy="214" rx="48" ry="10" fill="#000" opacity="0.28" />
      {/* wing flare — reads as lift-off, not a second card */}
      <path
        d="M102 128 C146 86 176 78 186 108 C172 118 152 140 126 158 C114 146 104 136 102 128 Z"
        fill="url(#hero-emerge-wing)"
        opacity="0.92"
      />
      {/* body echoes the pencil silhouette on paper */}
      <path
        d="M48 188 C42 140 68 92 112 82 C146 74 164 98 166 128 C168 160 148 188 114 200 C84 210 54 210 48 188 Z"
        fill="url(#hero-emerge-body)"
      />
      <path d="M112 82 C128 54 150 40 176 36" fill="none" stroke="#1b1630" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M166 128 C188 120 204 106 214 88" fill="none" stroke="#1b1630" strokeWidth="2" strokeLinecap="round" />
      <circle cx="128" cy="108" r="4.2" fill="#f6efe2" />
      <circle cx="129.5" cy="107.5" r="1.7" fill="#1b1630" />
      <path d="M108 78 L118 52 L128 80" fill="#f0b27a" />
      <path d="M72 196 l6 14 M88 200 l5 12" stroke="#1b1630" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HeroStage() {
  return (
    <div className="atelier-stage" aria-hidden="true">
      <div className="atelier-stage__wash" />
      <svg className="atelier-stage__thread" viewBox="0 0 420 360" preserveAspectRatio="none">
        <path
          className="atelier-stage__thread-line"
          d="M0 210 C72 198 120 168 168 148 C210 130 248 128 290 142"
          fill="none"
          stroke="#c4b49a"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="3 7"
        />
        <circle className="atelier-stage__ink" cx="96" cy="188" r="3.2" fill="#e36b4e" opacity="0.75" />
        <circle className="atelier-stage__ink" cx="148" cy="158" r="2.2" fill="#5b4fe0" opacity="0.7" />
        <circle className="atelier-stage__ink" cx="198" cy="140" r="4" fill="#e36b4e" opacity="0.45" />
        <circle className="atelier-stage__ink" cx="236" cy="132" r="2" fill="#f0b27a" opacity="0.8" />
      </svg>
      <div className="atelier-stage__paper">
        <HeroPaper />
        <span className="atelier-stage__tape atelier-stage__tape--a" />
        <span className="atelier-stage__tape atelier-stage__tape--b" />
        <span className="atelier-stage__halo" />
      </div>
      <div className="atelier-stage__cutout">
        <HeroEmergence />
      </div>
      <p className="atelier-stage__label">Poză → Lume AR</p>
    </div>
  );
}
