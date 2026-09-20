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
export const AR_RETRY_BUTTON_LABEL_RO = "Reîncearcă camera";
export const AR_CAMERA_PERMISSION_HINT_RO =
  "Experiența AR are nevoie de acces la cameră. Alege Permite când browserul te întreabă.";
/** @deprecated Untrustworthy catch-all. Kept for export stability; generated pages no longer use it. */
export const AR_CAMERA_DENIED_RO =
  "Accesul la cameră a fost refuzat. Activează camera din setările browserului și reîncearcă.";
export const AR_WATERMARK_RO = "Creat cu kidAR Studio";

export const AR_RUNTIME_STATES = [
  "idle",
  "starting",
  "camera-requested",
  "mindar-loading",
  "running",
  "failed"
] as const;
export type ArRuntimeState = (typeof AR_RUNTIME_STATES)[number];

export type ArFailureKind =
  | "permission"
  | "camera-unavailable"
  | "ar-init"
  | "unsupported"
  | "asset-network";

export const AR_FAILURE_COPY_RO: Record<ArFailureKind, string> = {
  permission:
    "Nu avem permisiunea pentru cameră. Activeaz-o din setările browserului, apoi încearcă din nou.",
  "camera-unavailable":
    "Camera nu este disponibilă acum. Închide alte aplicații care folosesc camera și încearcă din nou.",
  "ar-init": "Nu am putut porni experiența AR. Verifică internetul și încearcă din nou.",
  unsupported:
    "Acest browser nu poate porni experiența AR. Încearcă Safari sau Chrome pe telefon.",
  "asset-network": "Nu am putut încărca experiența. Verifică internetul și încearcă din nou."
};

export interface ArFailureSignal {
  name?: string;
  message?: string;
  mindarError?: string;
  httpStatus?: number;
  gumRequested?: boolean;
  mediaDevicesPresent?: boolean;
}

const PERMISSION_NAMES = new Set(["NotAllowedError", "PermissionDeniedError"]);
const CAMERA_UNAVAILABLE_NAMES = new Set([
  "NotReadableError",
  "TrackStartError",
  "AbortError",
  "OverconstrainedError",
  "ConstraintNotSatisfiedError",
  "NotFoundError",
  "DevicesNotFoundError"
]);

/**
 * Map a runtime failure signal to a user-facing kind.
 * MindAR `arError` / `VIDEO_FAIL` is not treated as a permission denial.
 */
export function classifyArStartError(signal: ArFailureSignal | null | undefined): ArFailureKind {
  const src = signal ?? {};
  const name = String(src.name || "");
  const message = String(src.message || "");
  const mindar = String(src.mindarError || "");
  const blob = `${name} ${message} ${mindar}`.toLowerCase();
  const status = src.httpStatus;

  if (src.mediaDevicesPresent === false) return "unsupported";
  if (
    /mediadevices|getusermedia/.test(blob) &&
    /undefined|not supported|not a function|insecure|secure context/.test(blob)
  ) {
    return "unsupported";
  }
  if (PERMISSION_NAMES.has(name) || /permission denied|notallowederror/.test(blob)) {
    return "permission";
  }
  if (
    CAMERA_UNAVAILABLE_NAMES.has(name) ||
    /could not start video|camera is in use|video source|overconstrained|notreadable|device not found|requested device not found/.test(
      blob
    )
  ) {
    return "camera-unavailable";
  }
  if (
    (typeof status === "number" && status >= 400) ||
    /failed to fetch|networkerror|load failed|net::err|content security policy/.test(blob)
  ) {
    return "asset-network";
  }
  if (mindar === "VIDEO_FAIL" && src.gumRequested === false) {
    return "unsupported";
  }
  return "ar-init";
}

const BLOCKED_START_STATES: ReadonlySet<ArRuntimeState> = new Set([
  "starting",
  "camera-requested",
  "mindar-loading",
  "running"
]);

export interface ArStartGate {
  getState(): ArRuntimeState;
  tryBegin(): boolean;
  setState(next: ArRuntimeState): void;
  fail(): void;
  succeed(): void;
}

/** In-memory start lock: one init while starting; retry only after failure. */
export function createArStartGate(initial: ArRuntimeState = "idle"): ArStartGate {
  let state: ArRuntimeState = initial;
  return {
    getState() {
      return state;
    },
    tryBegin() {
      if (BLOCKED_START_STATES.has(state)) return false;
      state = "starting";
      return true;
    },
    setState(next) {
      state = next;
    },
    fail() {
      state = "failed";
    },
    succeed() {
      state = "running";
    }
  };
}

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
 * `blob:` / `data:` are scoped to workers and media/images only:
 * - `worker-src` / `child-src`: MindAR/TFJS spawn blob workers and fall back
 *   to `data:` workers (`child-src` is the legacy worker fallback).
 *   `'wasm-unsafe-eval'` is required so WASM can compile inside those workers.
 * - `connect-src` includes `blob:` for TFJS/WASM byte fetches.
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
    `connect-src 'self' blob: ${originList}`,
    "worker-src 'self' blob: data: 'wasm-unsafe-eval'",
    "child-src 'self' blob: data: 'wasm-unsafe-eval'"
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

  const copyJs = {
    permission: escapeJsString(AR_FAILURE_COPY_RO.permission),
    cameraUnavailable: escapeJsString(AR_FAILURE_COPY_RO["camera-unavailable"]),
    arInit: escapeJsString(AR_FAILURE_COPY_RO["ar-init"]),
    unsupported: escapeJsString(AR_FAILURE_COPY_RO.unsupported),
    assetNetwork: escapeJsString(AR_FAILURE_COPY_RO["asset-network"]),
    retryLabel: escapeJsString(AR_RETRY_BUTTON_LABEL_RO)
  };

  // Inline script is static (no untrusted interpolation except JSON-encoded audio URL).
  const bootScript = `
(function () {
  var LOG_PREFIX = "[kidar-ar]";
  var startBtn = document.getElementById("kidar-start");
  var startPanel = document.getElementById("kidar-start-panel");
  var hint = document.getElementById("kidar-camera-hint");
  var errorEl = document.getElementById("kidar-error");
  var debugEl = document.getElementById("kidar-debug");
  var sceneEl = document.querySelector("a-scene");
  var targetEl = document.getElementById("kidar-target");
  var audioUrl = ${audioSrcJs};
  var audio = null;
  var debugEnabled = /(?:^|[?&])debug=1(?:&|$)/.test(location.search || "");
  var startClickRan = false;
  var gumRequested = false;
  var sceneLoaded = false;
  var mindarEvents = [];
  var mindFetch = "n/a";
  var lastError = "";
  var state = "idle";
  var COPY = {
    permission: ${copyJs.permission},
    "camera-unavailable": ${copyJs.cameraUnavailable},
    "ar-init": ${copyJs.arInit},
    unsupported: ${copyJs.unsupported},
    "asset-network": ${copyJs.assetNetwork}
  };

  if (audioUrl) {
    audio = new Audio(audioUrl);
    audio.loop = true;
    audio.preload = "none";
  }

  function log() {
    try {
      var args = [LOG_PREFIX];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.log.apply(console, args);
    } catch (e) {}
  }

  function uaFamily() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua)) {
      if (/CriOS/.test(ua)) return "ios-chrome";
      if (/FxiOS/.test(ua)) return "ios-firefox";
      return "ios-safari";
    }
    if (/Android/.test(ua)) return /Chrome/.test(ua) ? "android-chrome" : "android";
    if (/Edg/.test(ua)) return "desktop-edge";
    if (/Chrome/.test(ua)) return "desktop-chrome";
    if (/Safari/.test(ua)) return "desktop-safari";
    if (/Firefox/.test(ua)) return "desktop-firefox";
    return "other";
  }

  function safeErrorText(err) {
    if (!err) return "";
    var name = err.name ? String(err.name) : "Error";
    var msg = err.message ? String(err.message) : String(err);
    msg = msg.replace(/https?:\\/\\/\\S+/g, "[url]").replace(/[?&][^\\s]{0,120}/g, "");
    if (msg.length > 180) msg = msg.slice(0, 180);
    return name + ": " + msg;
  }

  function renderDebug() {
    if (!debugEnabled || !debugEl) return;
    debugEl.hidden = false;
    debugEl.textContent = [
      "state: " + state,
      "start-click: " + (startClickRan ? "yes" : "no"),
      "getUserMedia: " + (gumRequested ? "requested" : "no"),
      "error: " + (lastError || "none"),
      "a-scene loaded: " + (sceneLoaded ? "yes" : "no"),
      "mindar events: " + (mindarEvents.length ? mindarEvents.join(",") : "none"),
      "mind fetch: " + mindFetch,
      "ua: " + uaFamily()
    ].join("\\n");
  }

  function setState(next) {
    state = next;
    log("state", next);
    renderDebug();
  }

  function canBeginStart() {
    return state === "idle" || state === "failed";
  }

  function classifyFailure(signal) {
    signal = signal || {};
    var name = String(signal.name || "");
    var message = String(signal.message || "");
    var mindar = String(signal.mindarError || "");
    var blob = (name + " " + message + " " + mindar).toLowerCase();
    var status = signal.httpStatus;
    if (signal.mediaDevicesPresent === false) return "unsupported";
    if (/mediadevices|getusermedia/.test(blob) && /undefined|not supported|not a function|insecure|secure context/.test(blob)) {
      return "unsupported";
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || /permission denied|notallowederror/.test(blob)) {
      return "permission";
    }
    if (
      name === "NotReadableError" || name === "TrackStartError" || name === "AbortError" ||
      name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError" ||
      name === "NotFoundError" || name === "DevicesNotFoundError" ||
      /could not start video|camera is in use|video source|overconstrained|notreadable|device not found|requested device not found/.test(blob)
    ) {
      return "camera-unavailable";
    }
    if ((typeof status === "number" && status >= 400) || /failed to fetch|networkerror|load failed|net::err|content security policy/.test(blob)) {
      return "asset-network";
    }
    if (mindar === "VIDEO_FAIL" && signal.gumRequested === false) return "unsupported";
    return "ar-init";
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function restoreRetry() {
    if (hint) hint.hidden = true;
    if (!startBtn || !startPanel) return;
    startBtn.disabled = false;
    startBtn.textContent = ${copyJs.retryLabel};
    startPanel.hidden = false;
  }

  function stopArSystem() {
    var arSystem = sceneEl && sceneEl.systems && sceneEl.systems["mindar-image-system"];
    if (!arSystem || typeof arSystem.stop !== "function") return;
    try { arSystem.stop(); } catch (e) {}
  }

  function fail(kind, err, extra) {
    extra = extra || {};
    lastError = safeErrorText(err) || String(extra.mindarError || kind);
    log("fail", kind, lastError);
    if (state === "failed") {
      restoreRetry();
      renderDebug();
      return;
    }
    setState("failed");
    stopArSystem();
    showError(COPY[kind] || COPY["ar-init"]);
    restoreRetry();
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

  function noteMindar(eventName) {
    if (mindarEvents.indexOf(eventName) === -1) mindarEvents.push(eventName);
    log("event", eventName);
    renderDebug();
  }

  function installProbes() {
    var media = navigator.mediaDevices;
    if (media && typeof media.getUserMedia === "function" && !media.__kidarWrapped) {
      var originalGum = media.getUserMedia.bind(media);
      media.getUserMedia = function (constraints) {
        gumRequested = true;
        setState("camera-requested");
        log("getUserMedia requested");
        return originalGum(constraints).then(function (stream) {
          setState("mindar-loading");
          log("getUserMedia ok");
          return stream;
        }).catch(function (err) {
          lastError = safeErrorText(err);
          log("getUserMedia error", lastError);
          fail(classifyFailure({
            name: err && err.name,
            message: err && err.message,
            gumRequested: true,
            mediaDevicesPresent: true
          }), err);
          throw err;
        });
      };
      media.__kidarWrapped = true;
    }
    if (typeof window.fetch === "function" && !window.__kidarFetchWrapped) {
      var originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var isMind = /\\.mind(\\?|$)/.test(url);
        return originalFetch(input, init).then(function (res) {
          if (isMind) {
            mindFetch = "targets.mind HTTP " + res.status;
            log("mind fetch", mindFetch);
            renderDebug();
            if (!res.ok) {
              fail("asset-network", { name: "HttpError", message: "targets.mind HTTP " + res.status }, { httpStatus: res.status });
            }
          }
          return res;
        }).catch(function (err) {
          if (isMind) {
            mindFetch = "targets.mind network-error";
            log("mind fetch failed");
            renderDebug();
            fail("asset-network", err);
          }
          throw err;
        });
      };
      window.__kidarFetchWrapped = true;
    }
  }

  function getArSystem() {
    return sceneEl && sceneEl.systems && sceneEl.systems["mindar-image-system"];
  }

  function startExperience() {
    startClickRan = true;
    log("start click");
    renderDebug();
    if (!canBeginStart()) {
      log("start ignored", state);
      return;
    }
    setState("starting");
    if (errorEl) errorEl.hidden = true;
    if (hint) hint.hidden = false;
    if (startPanel) startPanel.hidden = true;
    if (startBtn) startBtn.disabled = true;
    var mediaOk = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
    if (!mediaOk) {
      fail("unsupported", { name: "NotSupportedError", message: "mediaDevices.getUserMedia missing" }, { mediaDevicesPresent: false });
      return;
    }
    var arSystem = getArSystem();
    if (!arSystem || typeof arSystem.start !== "function") {
      fail("ar-init", { name: "KidarArError", message: "mindar-image-system not ready" });
      return;
    }
    try {
      arSystem.start();
    } catch (err) {
      fail("ar-init", err);
    }
  }

  if (targetEl) {
    targetEl.addEventListener("targetFound", onTargetFound);
    targetEl.addEventListener("targetLost", onTargetLost);
  }

  if (sceneEl) {
    sceneEl.addEventListener("loaded", function () {
      sceneLoaded = true;
      log("a-scene loaded");
      renderDebug();
    });
    sceneEl.addEventListener("arReady", function () {
      noteMindar("arReady");
      setState("running");
      if (hint) hint.hidden = true;
      if (startPanel) startPanel.hidden = true;
    });
    sceneEl.addEventListener("arError", function (event) {
      var detail = (event && event.detail) || {};
      var mindarError = detail.error || "arError";
      noteMindar("arError:" + mindarError);
      if (state === "failed") return;
      var kind = classifyFailure({
        name: lastError ? lastError.split(":")[0] : "",
        message: lastError,
        mindarError: mindarError,
        gumRequested: gumRequested,
        mediaDevicesPresent: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      });
      fail(kind, lastError ? { name: lastError.split(":")[0], message: lastError } : { name: "MindARError", message: mindarError }, { mindarError: mindarError });
    });
  }

  window.addEventListener("unhandledrejection", function (event) {
    if (state !== "starting" && state !== "camera-requested" && state !== "mindar-loading") return;
    fail("ar-init", event && event.reason);
  });

  installProbes();
  if (startBtn) {
    startBtn.addEventListener("click", startExperience);
  }
  if (debugEnabled) {
    log("debug on", uaFamily());
    renderDebug();
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
    #kidar-start:disabled { opacity: .65; cursor: default; }
    #kidar-camera-hint, #kidar-error { position: absolute; left: 1rem; right: 1rem; bottom: 1.25rem; z-index: 4; margin: 0; padding: .75rem 1rem; border-radius: .65rem; text-align: center; font-size: .9rem; }
    #kidar-camera-hint { background: rgba(15,20,25,.85); }
    #kidar-camera-hint[hidden], #kidar-error[hidden], #kidar-debug[hidden] { display: none !important; }
    #kidar-error { background: #5c1d1d; color: #ffe8e8; }
    #kidar-debug { position: absolute; left: .5rem; right: .5rem; bottom: 4.75rem; z-index: 6; margin: 0; padding: .5rem .65rem; border-radius: .4rem; background: rgba(0,0,0,.82); color: #b7f5c8; font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; max-height: 36vh; overflow: auto; pointer-events: none; }
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
    <pre id="kidar-debug" hidden></pre>

    <a-scene
      mindar-image="imageTargetSrc: ${targetUrl}; autoStart: false; uiScanning: no; uiLoading: no; uiError: no"
      embedded
      loading-screen="enabled: false"
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
