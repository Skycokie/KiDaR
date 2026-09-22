import type { PersonalizeState } from "./form-state";

/**
 * Decorative poster — CSS/SVG only. No images, audio, or 3D.
 */
export function GardenPoster({ state }: { state: PersonalizeState }) {
  const showDecor = state.showInWorld;
  return (
    <div
      className={`garden-poster garden-poster--${state.atmosphere}`}
      data-character={state.character}
      data-effect={state.effect}
      data-position={state.position}
      data-scale={state.scale}
      data-visible={showDecor ? "yes" : "no"}
      aria-label={`Poster fixture: Grădina de după ploaie, atmosferă ${state.atmosphere}`}
    >
      <svg className="garden-poster__paper" viewBox="0 0 320 400" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1">
            <stop className="garden-poster__sky-top" offset="0%" />
            <stop className="garden-poster__sky-bot" offset="100%" />
          </linearGradient>
        </defs>
        <rect width="320" height="400" fill="url(#garden-sky)" rx="18" />
        <ellipse className="garden-poster__hill" cx="160" cy="340" rx="200" ry="90" />
        <path
          className="garden-poster__path"
          d="M40 360 C100 300 220 300 280 360"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle className="garden-poster__sun" cx="250" cy="90" r="28" />
        <g className="garden-poster__rain" opacity={state.atmosphere === "morning" ? 0.35 : 0}>
          <line x1="60" y1="70" x2="50" y2="110" />
          <line x1="110" y1="50" x2="100" y2="95" />
          <line x1="170" y1="80" x2="160" y2="120" />
          <line x1="210" y1="55" x2="200" y2="100" />
        </g>
      </svg>

      <div className="garden-poster__stage" aria-hidden={!showDecor}>
        {showDecor && state.effect !== "none" ? (
          <div className={`garden-poster__effect garden-poster__effect--${state.effect}`}>
            <span /><span /><span /><span /><span /><span />
          </div>
        ) : null}

        {showDecor && state.character !== "none" ? (
          <div
            className={`garden-poster__character garden-poster__character--${state.character} garden-poster__pos--${state.position} garden-poster__scale--${state.scale}`}
          >
            <CharacterGlyph kind={state.character} />
          </div>
        ) : null}
      </div>

      <p className="garden-poster__sound-chip" aria-hidden="true">
        {state.sound === "silence" ? "Liniște" : soundChip(state.sound)}
      </p>
    </div>
  );
}

function soundChip(sound: PersonalizeState["sound"]): string {
  if (sound === "rain") return "♪ Ploaie";
  if (sound === "forest") return "♪ Pădure";
  return "♪ Muzică";
}

function CharacterGlyph({ kind }: { kind: Exclude<PersonalizeState["character"], "none"> }) {
  if (kind === "butterfly") {
    return (
      <svg viewBox="0 0 64 64" className="garden-poster__glyph" aria-hidden="true">
        <ellipse cx="22" cy="28" rx="14" ry="18" className="fill-a" />
        <ellipse cx="42" cy="28" rx="14" ry="18" className="fill-b" />
        <rect x="30" y="18" width="4" height="28" rx="2" className="fill-ink" />
      </svg>
    );
  }
  if (kind === "dragon") {
    return (
      <svg viewBox="0 0 64 64" className="garden-poster__glyph" aria-hidden="true">
        <ellipse cx="32" cy="34" rx="22" ry="14" className="fill-a" />
        <circle cx="48" cy="28" r="10" className="fill-b" />
        <path d="M10 36 Q4 20 18 24" className="stroke-ink" fill="none" strokeWidth="3" />
        <circle cx="52" cy="26" r="2" className="fill-ink" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="garden-poster__glyph" aria-hidden="true">
      <circle cx="32" cy="36" r="16" className="fill-a" />
      <circle cx="22" cy="20" r="6" className="fill-b" />
      <circle cx="42" cy="20" r="6" className="fill-b" />
      <circle cx="27" cy="34" r="2" className="fill-ink" />
      <circle cx="37" cy="34" r="2" className="fill-ink" />
    </svg>
  );
}
