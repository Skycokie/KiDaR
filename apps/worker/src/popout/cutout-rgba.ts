import {
  alphaMaskFromRgba,
  assertPopoutCoverage,
  extractSilhouettePolygons,
  getSilhouetteStats,
  type SilhouetteStats,
  type StickerPolygon
} from "@kidar/core";

export type CutoutResult = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  polygons: StickerPolygon[];
  stats: SilhouetteStats;
};

/** Build cutout from pre-separated RGBA (tests / offline fixtures). */
export function createCutoutFromRgba(
  width: number,
  height: number,
  rgba: Uint8ClampedArray
): CutoutResult {
  const mask = alphaMaskFromRgba(width, height, rgba);
  const polygons = extractSilhouettePolygons(mask, {
    cleanupRadius: Math.max(1, Math.round(Math.min(width, height) / 800)),
    simplifyEpsilon: 0.006,
    minComponentPixels: Math.max(12, Math.floor(width * height * 0.00015))
  });
  if (!polygons.length) {
    throw new Error("No foreground silhouette was detected");
  }
  const stats = getSilhouetteStats(mask, polygons);
  assertPopoutCoverage(stats);
  return { width, height, rgba, polygons, stats };
}
