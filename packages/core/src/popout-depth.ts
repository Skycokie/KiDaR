/**
 * Discrete Z layering for multi-component pop-outs.
 * When the mask yields only one valid component, depth stays 0 (single-plate fallback).
 */

import type { StickerPolygon } from "./sticker-geometry";

/** Stable Z steps — intentional layers, not random noise. */
export const POPOUT_DEPTH_LEVELS = [0, 0.02, 0.04, 0.06] as const;

export type DepthScoredPolygon = {
  polygon: StickerPolygon;
  score: number;
  z: number;
};

function centroid(polygon: StickerPolygon): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const point of polygon.points) {
    x += point.x;
    y += point.y;
  }
  const n = polygon.points.length || 1;
  return { x: x / n, y: y / n };
}

/**
 * Visual depth score without an extra AI model.
 * Bottom-of-frame and larger / more central pieces tend to sit forward.
 */
export function scorePopoutDepth(polygon: StickerPolygon, maxArea: number): number {
  const center = centroid(polygon);
  // Normalized y: +0.5 = image top, −0.5 = image bottom → bottom should score high.
  const verticalBottom = Math.min(1, Math.max(0, 0.5 - center.y));
  // Mild center bias (compositional focus).
  const compositional = 1 - Math.min(1, Math.abs(center.x) * 1.4);
  // Relative size (larger pieces read as primary subjects).
  const relativeSize = maxArea > 0 ? Math.min(1, polygon.area / maxArea) : 0;
  // Contrast proxy: tiny noise scores low; primary pieces stay high.
  const contrast = relativeSize < 0.08 ? 0.35 : 1;

  return (
    0.45 * verticalBottom +
    0.25 * compositional +
    0.2 * contrast +
    0.1 * relativeSize
  );
}

/**
 * Drop speckles under ~0.35% of total silhouette area (relative to largest piece).
 */
export function filterPopoutComponents(
  polygons: StickerPolygon[],
  minAreaFraction = 0.0035
): StickerPolygon[] {
  if (!polygons.length) return [];
  const total = polygons.reduce((sum, item) => sum + item.area, 0);
  const floor = Math.max(polygons[0].area * minAreaFraction, total * 0.002);
  const kept = polygons.filter((item) => item.area >= floor);
  return kept.length ? kept : [polygons[0]];
}

/**
 * Assign discrete Z offsets. Single-component → all z=0 (safe fallback).
 */
export function assignPopoutDepthLayers(polygons: StickerPolygon[]): DepthScoredPolygon[] {
  const filtered = filterPopoutComponents(polygons);
  if (filtered.length <= 1) {
    return filtered.map((polygon) => ({ polygon, score: 0, z: 0 }));
  }

  const maxArea = Math.max(...filtered.map((item) => item.area));
  const scored = filtered
    .map((polygon) => ({
      polygon,
      score: scorePopoutDepth(polygon, maxArea),
      z: 0
    }))
    .sort((left, right) => left.score - right.score);

  const levelCount = Math.min(POPOUT_DEPTH_LEVELS.length, scored.length);
  for (let index = 0; index < scored.length; index += 1) {
    const levelIndex =
      levelCount <= 1
        ? 0
        : Math.min(
            POPOUT_DEPTH_LEVELS.length - 1,
            Math.floor((index / (scored.length - 1)) * (levelCount - 1) + 1e-9)
          );
    scored[index].z = POPOUT_DEPTH_LEVELS[levelIndex] ?? 0;
  }

  // Keep largest / highest-scoring piece from collapsing to the back when tied.
  return scored.sort((left, right) => right.polygon.area - left.polygon.area);
}
