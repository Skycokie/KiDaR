/**
 * Studio decor props → AR marker space.
 * Paths mirror apps/web/public/demo/decor/manifest.json (keep in sync).
 */

export const AR_DECOR_MAX = 16;
export const AR_DECOR_MARKER_SPAN = 1;
export const AR_DECOR_DEFAULT_SCALE = 0.25;

/** Ids that ship a GLB under /demo/glb (same set as Studio DECOR_GLB_AVAILABLE). */
export const AR_DECOR_GLB_PATH: Readonly<Record<string, string>> = {
  stars: "/demo/glb/decor/stars.glb",
  grass: "/demo/glb/decor/grass.glb",
  tree: "/demo/glb/decor/tree.glb",
  house: "/demo/glb/decor/house.glb",
  balloons: "/demo/glb/decor/balloons.glb",
  figureWave: "/demo/glb/motion/wave.glb",
  figureFloat: "/demo/glb/motion/float.glb",
  figureDance: "/demo/glb/motion/dance.glb",
  figureJump: "/demo/glb/motion/jump.glb",
  figureStill: "/demo/glb/motion/still.glb",
  figureFollow: "/demo/glb/motion/follow.glb"
};

export const AR_DECOR_SCALE_BY_ID: Readonly<Record<string, number>> = {
  stars: 0.18,
  grass: 0.28,
  tree: 0.35,
  house: 0.32,
  balloons: 0.28,
  figureWave: 0.22,
  figureFloat: 0.22,
  figureDance: 0.22,
  figureJump: 0.22,
  figureStill: 0.22,
  figureFollow: 0.22
};

/** Persisted on ProjectSettings.scene.decor (yaw/pitch in degrees). */
export interface ArDecorProp {
  id: string;
  x: number;
  y: number;
  yaw: number;
  pitch: number;
}

export interface ArDecorResolved {
  id: string;
  modelUrl: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export function isKnownArDecorId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(AR_DECOR_GLB_PATH, id);
}

export function clampDecorPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(96, Math.max(4, value));
}

export function clampDecorAngleDeg(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(89, Math.max(-89, value));
}

/** Yaw is a full turn: wrap into (-180, 180] instead of clamping. */
export function wrapDecorYawDeg(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** Studio stage % → MindAR marker-local meters (Y inverted). */
export function stagePercentToMarkerPosition(x: number, y: number): { x: number; y: number; z: number } {
  const px = clampDecorPercent(x);
  const py = clampDecorPercent(y);
  return {
    x: ((px - 50) / 100) * AR_DECOR_MARKER_SPAN,
    y: ((50 - py) / 100) * AR_DECOR_MARKER_SPAN,
    z: 0.05
  };
}

export function decorGlbPublicUrl(appOrigin: string, id: string): string | null {
  const path = AR_DECOR_GLB_PATH[id];
  if (!path) return null;
  try {
    const origin = new URL(appOrigin).origin;
    return `${origin}${path}`;
  } catch {
    return null;
  }
}

/**
 * Normalize a raw decor array from Studio / PATCH.
 * Radians from Studio preview are converted by the caller before persist;
 * this accepts degrees already.
 */
export function normalizeArDecorList(raw: unknown): ArDecorProp[] {
  if (!Array.isArray(raw)) return [];
  const out: ArDecorProp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim() : "";
    if (!isKnownArDecorId(id)) continue;
    const x = typeof rec.x === "number" ? clampDecorPercent(rec.x) : 50;
    const y = typeof rec.y === "number" ? clampDecorPercent(rec.y) : 50;
    const yaw = typeof rec.yaw === "number" ? wrapDecorYawDeg(rec.yaw) : 0;
    const pitch = typeof rec.pitch === "number" ? clampDecorAngleDeg(rec.pitch) : 0;
    out.push({ id, x, y, yaw, pitch });
    if (out.length >= AR_DECOR_MAX) break;
  }
  return out;
}

/** Studio DecorInstance (yaw/pitch radians) → persisted ArDecorProp degrees. */
export function studioDecorToArProps(
  instances: Array<{ id: string; x: number; y: number; yaw: number; pitch: number }>
): ArDecorProp[] {
  return normalizeArDecorList(
    instances.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      yaw: (item.yaw * 180) / Math.PI,
      pitch: (item.pitch * 180) / Math.PI
    }))
  );
}

export function resolveArDecorProps(input: {
  decor: ArDecorProp[] | null | undefined;
  appOrigin: string;
}): ArDecorResolved[] {
  const list = normalizeArDecorList(input.decor ?? []);
  const resolved: ArDecorResolved[] = [];
  for (const prop of list) {
    const modelUrl = decorGlbPublicUrl(input.appOrigin, prop.id);
    if (!modelUrl) continue;
    resolved.push({
      id: prop.id,
      modelUrl,
      position: stagePercentToMarkerPosition(prop.x, prop.y),
      rotation: { x: prop.pitch, y: prop.yaw, z: 180 },
      scale: AR_DECOR_SCALE_BY_ID[prop.id] ?? AR_DECOR_DEFAULT_SCALE
    });
  }
  return resolved;
}

/** Stable identity for page_render hash. */
export function decorHashIdentity(decor: ArDecorProp[] | null | undefined): Array<Record<string, number | string>> | null {
  const list = normalizeArDecorList(decor ?? []);
  if (list.length === 0) return null;
  return list.map((p) => ({
    id: p.id,
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
    yaw: Math.round(p.yaw * 1000) / 1000,
    pitch: Math.round(p.pitch * 1000) / 1000
  }));
}
