/**
 * Effective AR model start pose for page_render mapping + page identity.
 * Incomplete or out-of-range optional scene data falls back to legacy offset/scale
 * and MindAR baseline rotation { x: 0, y: 0, z: 180 }. Never throws.
 */

export type ArVec3 = { x: number; y: number; z: number };

export type EffectiveArTransform = {
  position: ArVec3;
  rotation: ArVec3;
  scale: number;
};

const POSITION_LIMIT = 5;
const SCALE_MAX = 10;
const LEGACY_ROTATION: ArVec3 = { x: 0, y: 0, z: 180 };

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readVec3(value: unknown): ArVec3 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!finiteNumber(record.x) || !finiteNumber(record.y) || !finiteNumber(record.z)) return null;
  return { x: record.x, y: record.y, z: record.z };
}

function inPositionRange(v: ArVec3): boolean {
  return (
    v.x >= -POSITION_LIMIT &&
    v.x <= POSITION_LIMIT &&
    v.y >= -POSITION_LIMIT &&
    v.y <= POSITION_LIMIT &&
    v.z >= -POSITION_LIMIT &&
    v.z <= POSITION_LIMIT
  );
}

function inScaleRange(scale: number): boolean {
  return scale > 0 && scale <= SCALE_MAX;
}

export type SettingsForArTransform = {
  offset: ArVec3;
  scale: number;
  scene?: { startTransform?: unknown } | null;
};

/**
 * Returns a complete transform for AR HTML. Valid saved startTransform wins;
 * otherwise legacy offset/scale + {0,0,180}.
 */
export function resolveEffectiveArTransform(settings: SettingsForArTransform): EffectiveArTransform {
  const legacy: EffectiveArTransform = {
    position: {
      x: finiteNumber(settings.offset?.x) ? settings.offset.x : 0,
      y: finiteNumber(settings.offset?.y) ? settings.offset.y : 0,
      z: finiteNumber(settings.offset?.z) ? settings.offset.z : 0
    },
    rotation: { ...LEGACY_ROTATION },
    scale: finiteNumber(settings.scale) && inScaleRange(settings.scale) ? settings.scale : 1
  };

  const raw = settings.scene?.startTransform;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return legacy;
  const record = raw as Record<string, unknown>;
  const rotation = readVec3(record.rotation);
  const position = readVec3(record.position);
  const scale = record.scale;
  if (!rotation || !position || !finiteNumber(scale)) return legacy;
  if (!inPositionRange(position) || !inScaleRange(scale)) return legacy;
  return { position, rotation, scale };
}

/** Canonical page-identity slice — omit when equal to legacy-from-offset would be wasteful; always pass effective. */
export function pageStartTransformIdentity(settings: SettingsForArTransform): EffectiveArTransform {
  return resolveEffectiveArTransform(settings);
}
