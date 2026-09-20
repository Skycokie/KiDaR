/**
 * Worker-owned runtime object keys and upstream URLs.
 *
 * These are not re-exported from `@kidar/core`. The core barrel only exposes
 * symbols that exist on the packaged AR template. Worker jobs still need
 * stable `runtime/*.js` keys for tests and optional script materialization.
 */
export const AFRAME_RUNTIME_OBJECT_KEY = "runtime/aframe-1.5.0-master.min.js";
export const MINDAR_RUNTIME_OBJECT_KEY = "runtime/mindar-image-aframe-1.2.5.prod.js";

export const AFRAME_UPSTREAM_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/aframe@1.5.0/dist/aframe-master.min.js";
export const MINDAR_UPSTREAM_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";
