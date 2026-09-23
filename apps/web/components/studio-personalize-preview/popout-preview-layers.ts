/**
 * Local preview pop-out layering — mirrors packages/core popout-depth intent
 * (discrete Z steps, filter tiny parts) without pulling mesh/GLB code into the shell.
 */

/** Same discrete steps as POPOUT_DEPTH_LEVELS in @kidar/core. */
export const PREVIEW_POPOUT_DEPTH_LEVELS = [0, 0.02, 0.04, 0.06] as const;

/** Warm edge palette — never blue. */
export const POPOUT_EDGE_COLORS = {
  paper: "#c9a06a",
  warm: "#b88458",
  deep: "#8f6540",
  shadow: "rgba(60, 36, 18, 0.28)"
} as const;

/**
 * Map Volum (0–100) to CSS extrusion depth in px.
 * Low → shallow paper lift; high → clearer side edge.
 */
export function popoutExtrusionPx(volume: number): number {
  const v = Math.min(100, Math.max(0, volume));
  return Math.round(10 + (v / 100) * 42);
}

/** Discrete layer Z offsets in px, scaled by volume. */
export function popoutLayerOffsetsPx(volume: number): number[] {
  const max = popoutExtrusionPx(volume);
  const peak = PREVIEW_POPOUT_DEPTH_LEVELS[PREVIEW_POPOUT_DEPTH_LEVELS.length - 1] || 0.06;
  return PREVIEW_POPOUT_DEPTH_LEVELS.map((level) => Math.round((level / peak) * max));
}

/**
 * Figurine volume scale — steeper than pop-out so Volum clearly inflates the toy.
 * Pop-out uses ~0.72 + v/180; figurine spans a wider, rounder range.
 */
export function figurineVolumeScale(volume: number): number {
  const v = Math.min(100, Math.max(0, volume));
  return 0.82 + (v / 100) * 0.72;
}

/** Soft clay puff factor for limb/body rounding in figurine mode. */
export function figurinePuff(volume: number): number {
  const v = Math.min(100, Math.max(0, volume));
  return 1 + (v / 100) * 0.22;
}

/**
 * Fixture body parts for multi-component pop-out (cheeks/eyes stay front-only).
 * Larger / lower parts sit forward — same score spirit as scorePopoutDepth.
 */
export const FIXTURE_POPOUT_PARTS = [
  { id: "legs", label: "Picioare", depthLevel: 0, edge: POPOUT_EDGE_COLORS.deep },
  { id: "torso", label: "Corp", depthLevel: 1, edge: POPOUT_EDGE_COLORS.warm },
  { id: "arms", label: "Brațe", depthLevel: 2, edge: POPOUT_EDGE_COLORS.paper },
  { id: "head", label: "Cap", depthLevel: 3, edge: POPOUT_EDGE_COLORS.warm }
] as const;

export type FixturePopoutPartId = (typeof FIXTURE_POPOUT_PARTS)[number]["id"];
