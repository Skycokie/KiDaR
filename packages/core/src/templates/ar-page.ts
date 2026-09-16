/**
 * Pure static AR experience HTML renderer (M4.4a).
 *
 * Generates standalone MindAR + A-Frame HTML. Does not upload, route, or publish.
 * Public immutable writes belong to M4.4b.
 */

import {
  assertPublicAbsoluteUrl,
  escapeHtml,
  escapeHtmlAttr,
  escapeJsString,
  PublicUrlError
} from "../public-url";
import { MIND_AR_PACKAGE_VERSION } from "../mind";

/** Pinned A-Frame release documented alongside mind-ar@1.2.5 image-tracking examples. */
export const AFRAME_CDN_VERSION = "1.5.0";

export const AFRAME_SCRIPT_URL = `https://aframe.io/releases/${AFRAME_CDN_VERSION}/aframe.min.js`;
export const MINDAR_AFRAME_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/mind-ar@${MIND_AR_PACKAGE_VERSION}/dist/mindar-image-aframe.prod.js`;

export const DEFAULT_AR_INSTRUCTIONS_RO =
  "Îndreaptă camera spre desenul tipărit pentru a vedea modelul 3D.";
export const AR_START_BUTTON_LABEL_RO = "Pornește experiența AR";
export const AR_CAMERA_PERMISSION_HINT_RO =
  "Experiența AR are nevoie de acces la cameră. Alege Permite când browserul te întreabă.";
export const AR_CAMERA_DENIED_RO =
  "Accesul la cameră a fost refuzat. Activează camera din setările browserului și reîncearcă.";
export const AR_WATERMARK_RO = "Creat cu kidAR Studio";

const THEME_HEX = /^#[0-9a-fA-F]{6}$/;
const TITLE_MAX = 120;
const CTA_TEXT_MAX = 80;
const INSTRUCTIONS_MAX = 280;

export class ArPageConfigError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_AR_PAGE_CONFIG") {
    super(message);
    this.name = "ArPageConfigError";
    this.code = code;
  }
}

export interface ArPageVec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Validated input for {@link renderArPage}.
 * Aligns with ProjectSettings branding/transform fields; callers map settings → config.
 */
export interface ArPageConfig {
  /** Romanian (or localized) page title — escaped into HTML. */
  title: string;
  /** Accent color as #RRGGBB (studio color picker). */
  theme: string;
  /** Public HTTPS URL to the GLB/glTF model. */
  modelUrl: string;
  /** Public HTTPS URL to the compiled `.mind` target. */
  targetUrl: string;
  /** Optional Romanian instructions under the title. */
  instructions?: string;
  /** Optional public logo image URL. */
  logoUrl?: string;
  /** Optional CTA label. */
  ctaText?: string;
  /** Optional CTA destination URL. */
  ctaUrl?: string;
  /** Optional public audio URL; plays only after MindAR `targetFound`. */
  audioUrl?: string;
  /** Model transform — defaults match studio (scale 1, offset 0). */
  transform?: {
    position?: Partial<ArPageVec3>;
    /** Euler degrees for A-Frame rotation attribute. */
    rotation?: Partial<ArPageVec3>;
    scale?: number;
  };
  /** Free-tier watermark when whitelabel is unavailable. */
  showWatermark?: boolean;
  /** Extra HTTPS origins allowed in CSP (asset hosts beyond model/target/logo/audio). */
  assetOrigins?: string[];
  /** Allow http(s) localhost / 127.0.0.1 / ::1 for unit tests. */
  allowLocalOrigins?: boolean;
}

export interface NormalizedArPageConfig {
  title: string;
  theme: string;
  modelUrl: string;
  targetUrl: string;
  instructions: string;
  logoUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  audioUrl: string | null;
  position: ArPageVec3;
  rotation: ArPageVec3;
  scale: number;
  showWatermark: boolean;
  assetOrigins: string[];
  allowLocalOrigins: boolean;
}

function finiteNumber(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ArPageConfigError(`${label} must be a finite number`, "INVALID_TRANSFORM");
  }
  return value;
}

function normalizeVec3(
  partial: Partial<ArPageVec3> | undefined,
  label: string,
  defaults: ArPageVec3
): ArPageVec3 {
  return {
    x: finiteNumber(partial?.x, `${label}.x`, defaults.x),
    y: finiteNumber(partial?.y, `${label}.y`, defaults.y),
    z: finiteNumber(partial?.z, `${label}.z`, defaults.z)
  };
}

function assertTheme(theme: string): string {
  if (typeof theme !== "string" || !THEME_HEX.test(theme.trim())) {
    throw new ArPageConfigError("theme must be a #RRGGBB hex color", "INVALID_THEME");
  }
  return theme.trim().toLowerCase();
}

function assertTitle(title: string): string {
  if (typeof title !== "string" || !title.trim()) {
    throw new ArPageConfigError("title is required", "MISSING_TITLE");
  }
  const trimmed = title.trim();
  if (trimmed.length > TITLE_MAX) {
    throw new ArPageConfigError(`title must be ≤ ${TITLE_MAX} characters`, "TITLE_TOO_LONG");
  }
  return trimmed;
}

function optionalPublicUrl(
  raw: string | undefined,
  options: { allowLocalOrigins?: boolean; label: string; requirePathSuffix?: string }
): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  try {
    return assertPublicAbsoluteUrl(raw, options).href;
  } catch (error) {
    if (error instanceof PublicUrlError) {
      throw new ArPageConfigError(error.message, error.code);
    }
    throw error;
  }
}

function collectAssetOrigins(config: NormalizedArPageConfig): string[] {
  const origins = new Set<string>([
    "https://aframe.io",
    "https://cdn.jsdelivr.net",
    ...config.assetOrigins
  ]);
  for (const href of [config.modelUrl, config.targetUrl, config.logoUrl, config.audioUrl, config.ctaUrl]) {
    if (!href) continue;
    try {
      origins.add(new URL(href).origin);
    } catch {
      // already validated
    }
  }
  return [...origins].sort();
}

/**
 * Validate and normalize {@link ArPageConfig} without rendering.
 */
export function normalizeArPageConfig(config: ArPageConfig): NormalizedArPageConfig {
  if (!config || typeof config !== "object") {
    throw new ArPageConfigError("config is required", "MISSING_CONFIG");
  }

  const allowLocalOrigins = Boolean(config.allowLocalOrigins);
  const title = assertTitle(config.title);
  const theme = assertTheme(config.theme);

  let modelUrl: string;
  let targetUrl: string;
  try {
    modelUrl = assertPublicAbsoluteUrl(config.modelUrl, {
      allowLocalOrigins,
      label: "modelUrl"
    }).href;
    targetUrl = assertPublicAbsoluteUrl(config.targetUrl, {
      allowLocalOrigins,
      label: "targetUrl",
      requirePathSuffix: ".mind"
    }).href;
  } catch (error) {
    if (error instanceof PublicUrlError) {
      throw new ArPageConfigError(error.message, error.code);
    }
    throw error;
  }

  const instructions =
    config.instructions === undefined || config.instructions === ""
      ? DEFAULT_AR_INSTRUCTIONS_RO
      : config.instructions.trim();
  if (instructions.length > INSTRUCTIONS_MAX) {
    throw new ArPageConfigError(
      `instructions must be ≤ ${INSTRUCTIONS_MAX} characters`,
      "INSTRUCTIONS_TOO_LONG"
    );
  }

  const logoUrl = optionalPublicUrl(config.logoUrl, { allowLocalOrigins, label: "logoUrl" });
  const audioUrl = optionalPublicUrl(config.audioUrl, { allowLocalOrigins, label: "audioUrl" });
  const ctaUrl = optionalPublicUrl(config.ctaUrl, { allowLocalOrigins, label: "ctaUrl" });

  let ctaText: string | null = null;
  if (config.ctaText !== undefined && config.ctaText !== null && config.ctaText !== "") {
    ctaText = config.ctaText.trim();
    if (ctaText.length > CTA_TEXT_MAX) {
      throw new ArPageConfigError(`ctaText must be ≤ ${CTA_TEXT_MAX} characters`, "CTA_TOO_LONG");
    }
  }
  if ((ctaText && !ctaUrl) || (!ctaText && ctaUrl)) {
    throw new ArPageConfigError("ctaText and ctaUrl must be provided together", "INVALID_CTA");
  }

  const scale = finiteNumber(config.transform?.scale, "scale", 1);
  if (scale <= 0 || scale > 10) {
    throw new ArPageConfigError("scale must be in (0, 10]", "INVALID_SCALE");
  }

  const position = normalizeVec3(config.transform?.position, "position", { x: 0, y: 0, z: 0 });
  const rotation = normalizeVec3(config.transform?.rotation, "rotation", { x: 0, y: 0, z: 0 });

  const assetOrigins: string[] = [];
  if (config.assetOrigins) {
    for (const origin of config.assetOrigins) {
      let parsed: URL;
      try {
        const candidate = origin.includes("://") ? origin : `https://${origin}`;
        parsed = assertPublicAbsoluteUrl(candidate, {
          allowLocalOrigins,
          label: "assetOrigins entry"
        });
      } catch (error) {
        if (error instanceof PublicUrlError) {
          throw new ArPageConfigError(error.message, error.code);
        }
        throw error;
      }
      assetOrigins.push(parsed.origin);
    }
  }

  return {
    title,
    theme,
    modelUrl,
    targetUrl,
    instructions,
    logoUrl,
    ctaText,
    ctaUrl,
    audioUrl,
    position,
    rotation,
    scale,
    showWatermark: Boolean(config.showWatermark),
    assetOrigins,
    allowLocalOrigins
  };
}

function formatVec3(v: ArPageVec3): string {
  return `${v.x} ${v.y} ${v.z}`;
}

/**
 * CSP for the standalone AR page.
 *
 * `'wasm-unsafe-eval'` is required in `script-src` so MindAR's TFJS WASM
 * backend can instantiate WebAssembly. This is not `'unsafe-eval'` and does
 * not allow `eval()` / `new Function()`.
 *
 * `blob:` is scoped to workers and media/images only:
 * - `worker-src` / `child-src`: MindAR/A-Frame spawn blob workers for tracking
 *   (`child-src` is the legacy worker fallback).
 * - `media-src`: camera preview / decoded media object URLs after Start.
 * - `img-src`: canvas/`data:` snapshots used by tracking overlays.
 */
export function buildArPageCsp(assetOrigins: string[]): string {
  const originList = assetOrigins.join(" ");
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    `script-src 'unsafe-inline' 'wasm-unsafe-eval' ${originList}`,
    "style-src 'unsafe-inline'",
    `img-src 'self' data: blob: ${originList}`,
    `media-src 'self' blob: ${originList}`,
    `connect-src 'self' ${originList}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:"
  ].join("; ");
}

/**
 * Escape a CSP string for a double-quoted HTML content attribute.
 * Single quotes must remain literal — they are CSP keyword syntax (`'self'`),
 * and encoding them as `&#39;` would also break naive `;`-separated parsers.
 */
function escapeCspAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Render a standalone static AR HTML document.
 * Camera / MindAR start only after the Start button click (`autoStart: false` + `arSystem.start()`).
 * Optional audio plays only on `targetFound` and pauses on `targetLost`.
 */
export function renderArPage(config: ArPageConfig): string {
  const normalized = normalizeArPageConfig(config);
  const cspOrigins = collectAssetOrigins(normalized);

  const title = escapeHtml(normalized.title);
  const instructions = escapeHtml(normalized.instructions);
  const theme = escapeHtmlAttr(normalized.theme);
  const modelUrl = escapeHtmlAttr(normalized.modelUrl);
  const targetUrl = escapeHtmlAttr(normalized.targetUrl);
  const position = escapeHtmlAttr(formatVec3(normalized.position));
  const rotation = escapeHtmlAttr(formatVec3(normalized.rotation));
  const scaleAttr = escapeHtmlAttr(
    `${normalized.scale} ${normalized.scale} ${normalized.scale}`
  );

  const logoHtml = normalized.logoUrl
    ? `<img class="logo" src="${escapeHtmlAttr(normalized.logoUrl)}" alt="" width="96" height="96" />`
    : "";

  const ctaHtml =
    normalized.ctaText && normalized.ctaUrl
      ? `<a class="cta" href="${escapeHtmlAttr(normalized.ctaUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(normalized.ctaText)}</a>`
      : "";

  const watermarkHtml = normalized.showWatermark
    ? `<p class="watermark">${escapeHtml(AR_WATERMARK_RO)}</p>`
    : "";

  const audioSrcJs = normalized.audioUrl ? escapeJsString(normalized.audioUrl) : "null";

  const csp = buildArPageCsp(cspOrigins);

  // Inline script is static (no untrusted interpolation except JSON-encoded audio URL).
  const bootScript = `
(function () {
  var startBtn = document.getElementById("kidar-start");
  var startPanel = document.getElementById("kidar-start-panel");
  var hint = document.getElementById("kidar-camera-hint");
  var errorEl = document.getElementById("kidar-error");
  var sceneEl = document.querySelector("a-scene");
  var targetEl = document.getElementById("kidar-target");
  var audioUrl = ${audioSrcJs};
  var audio = null;
  var started = false;

  if (audioUrl) {
    audio = new Audio(audioUrl);
    audio.loop = true;
    audio.preload = "none";
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function onTargetFound() {
    if (audio) {
      var playResult = audio.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function () {});
      }
    }
  }

  function onTargetLost() {
    if (audio) {
      audio.pause();
      try { audio.currentTime = 0; } catch (e) {}
    }
  }

  if (targetEl) {
    targetEl.addEventListener("targetFound", onTargetFound);
    targetEl.addEventListener("targetLost", onTargetLost);
  }

  if (sceneEl) {
    sceneEl.addEventListener("arError", function () {
      showError(${escapeJsString(AR_CAMERA_DENIED_RO)});
    });
  }

  function startExperience() {
    if (started) return;
    started = true;
    if (errorEl) errorEl.hidden = true;
    if (hint) hint.hidden = false;
    if (startPanel) startPanel.hidden = true;
    var arSystem = sceneEl && sceneEl.systems && sceneEl.systems["mindar-image-system"];
    if (!arSystem || typeof arSystem.start !== "function") {
      showError(${escapeJsString(AR_CAMERA_DENIED_RO)});
      return;
    }
    try {
      arSystem.start();
    } catch (err) {
      showError(${escapeJsString(AR_CAMERA_DENIED_RO)});
    }
  }

  if (startBtn) {
    startBtn.addEventListener("click", startExperience);
  }
})();
`.trim();

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta http-equiv="Content-Security-Policy" content="${escapeCspAttribute(csp)}" />
  <title>${title}</title>
  <script src="${escapeHtmlAttr(AFRAME_SCRIPT_URL)}"></script>
  <script src="${escapeHtmlAttr(MINDAR_AFRAME_SCRIPT_URL)}"></script>
  <style>
    :root { --kidar-theme: ${theme}; --kidar-bg: #0f1419; --kidar-fg: #f4f7fb; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: var(--kidar-bg); color: var(--kidar-fg); font-family: "Segoe UI", system-ui, sans-serif; }
    .shell { position: fixed; inset: 0; display: flex; flex-direction: column; }
    .top { position: relative; z-index: 3; padding: 1rem 1.25rem; background: linear-gradient(180deg, rgba(15,20,25,.92), rgba(15,20,25,.35) 85%, transparent); pointer-events: none; }
    .top * { pointer-events: auto; }
    .brand-row { display: flex; align-items: center; gap: .75rem; }
    .logo { object-fit: contain; border-radius: .5rem; background: rgba(255,255,255,.08); }
    h1 { margin: 0; font-size: 1.25rem; line-height: 1.3; }
    .instructions { margin: .4rem 0 0; opacity: .9; font-size: .95rem; }
    .cta { display: inline-block; margin-top: .75rem; color: #fff; background: var(--kidar-theme); padding: .45rem .9rem; border-radius: .5rem; text-decoration: none; font-weight: 600; }
    .watermark { margin: .5rem 0 0; font-size: .75rem; opacity: .65; }
    #kidar-start-panel { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: rgba(8,10,14,.72); backdrop-filter: blur(4px); }
    #kidar-start-panel[hidden] { display: none !important; }
    .start-card { max-width: 22rem; width: 100%; text-align: center; }
    #kidar-start { appearance: none; border: 0; cursor: pointer; width: 100%; padding: .9rem 1.1rem; border-radius: .75rem; font-size: 1.05rem; font-weight: 700; color: #111; background: var(--kidar-theme); }
    #kidar-camera-hint, #kidar-error { position: absolute; left: 1rem; right: 1rem; bottom: 1.25rem; z-index: 4; margin: 0; padding: .75rem 1rem; border-radius: .65rem; text-align: center; font-size: .9rem; }
    #kidar-camera-hint { background: rgba(15,20,25,.85); }
    #kidar-camera-hint[hidden], #kidar-error[hidden] { display: none !important; }
    #kidar-error { background: #5c1d1d; color: #ffe8e8; }
    a-scene { position: absolute; inset: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="shell">
    <header class="top">
      <div class="brand-row">
        ${logoHtml}
        <div>
          <h1>${title}</h1>
          <p class="instructions">${instructions}</p>
          ${ctaHtml}
          ${watermarkHtml}
        </div>
      </div>
    </header>

    <div id="kidar-start-panel">
      <div class="start-card">
        <button type="button" id="kidar-start">${escapeHtml(AR_START_BUTTON_LABEL_RO)}</button>
      </div>
    </div>

    <p id="kidar-camera-hint" hidden>${escapeHtml(AR_CAMERA_PERMISSION_HINT_RO)}</p>
    <p id="kidar-error" hidden role="alert"></p>

    <a-scene
      mindar-image="imageTargetSrc: ${targetUrl}; autoStart: false; uiScanning: no; uiLoading: no; uiError: no"
      embedded
      color-space="sRGB"
      renderer="colorManagement: true, physicallyCorrectLights"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
    >
      <a-assets>
        <a-asset-item id="kidar-model" src="${modelUrl}"></a-asset-item>
      </a-assets>
      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
      <a-entity id="kidar-target" mindar-image-target="targetIndex: 0">
        <a-gltf-model
          src="#kidar-model"
          position="${position}"
          rotation="${rotation}"
          scale="${scaleAttr}"
        ></a-gltf-model>
      </a-entity>
    </a-scene>
  </div>
  <script>
${bootScript}
  </script>
</body>
</html>
`;
}
