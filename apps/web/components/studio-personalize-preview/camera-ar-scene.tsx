import type { CameraArPhase } from "./camera-ar-fixtures";
import { CAMERA_AR_COPY, CAMERA_AR_FIXTURE_OVERLAY } from "./camera-ar-fixtures";
import { showsGuideFrame, showsWorldOverlay, worldOverlayDimmed } from "./camera-ar-state";

/**
 * Decorative AR frame — CSS/SVG only. No video, canvas, or device camera.
 */
export function CameraArScene({ phase }: { phase: CameraArPhase }) {
  const guide = showsGuideFrame(phase);
  const world = showsWorldOverlay(phase);
  const dimmed = worldOverlayDimmed(phase);

  return (
    <div
      className={`cam-ar-scene cam-ar-scene--${phase}`}
      data-phase={phase}
      data-guide={guide ? "yes" : "no"}
      data-world={world ? "yes" : "no"}
      aria-hidden="true"
    >
      <div className="cam-ar-scene__feed" />

      <div className="cam-ar-scene__poster">
        <svg viewBox="0 0 240 300" className="cam-ar-scene__paper">
          <defs>
            <linearGradient id="cam-ar-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0a06a" />
              <stop offset="100%" stopColor="#5a3a5c" />
            </linearGradient>
          </defs>
          <rect width="240" height="300" rx="12" fill="url(#cam-ar-sky)" />
          <ellipse cx="120" cy="250" rx="140" ry="60" fill="#3d6b4f" />
          <circle cx="180" cy="70" r="22" fill="#f2d08a" />
          <text x="120" y="160" textAnchor="middle" fill="#efe4cf" fontSize="11" opacity="0.85">
            {CAMERA_AR_COPY.fixtureTitle}
          </text>
        </svg>
      </div>

      {guide ? (
        <div className="cam-ar-scene__guide">
          <span className="cam-ar-scene__corner cam-ar-scene__corner--tl" />
          <span className="cam-ar-scene__corner cam-ar-scene__corner--tr" />
          <span className="cam-ar-scene__corner cam-ar-scene__corner--bl" />
          <span className="cam-ar-scene__corner cam-ar-scene__corner--br" />
        </div>
      ) : null}

      <div
        className={`cam-ar-scene__world${world ? " is-visible" : ""}${dimmed ? " is-dimmed" : ""}`}
        data-testid="cam-ar-world-overlay"
      >
        <svg viewBox="0 0 64 64" className="cam-ar-scene__glyph" aria-hidden="true">
          <ellipse cx="22" cy="28" rx="14" ry="18" fill="#f0c27a" />
          <ellipse cx="42" cy="28" rx="14" ry="18" fill="#e27b4f" />
          <rect x="30" y="18" width="4" height="28" rx="2" fill="#2a241c" />
        </svg>
        <div className="cam-ar-scene__stars" data-effect={CAMERA_AR_FIXTURE_OVERLAY.effect}>
          <span /><span /><span /><span />
        </div>
      </div>

      {phase === "preparing" ? (
        <div className="cam-ar-scene__loader" role="presentation">
          <span className="cam-ar-scene__spinner" />
        </div>
      ) : null}
    </div>
  );
}
