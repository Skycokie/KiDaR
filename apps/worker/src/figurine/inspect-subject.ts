/**
 * Deterministic subject inspection before Tripo — no provider calls.
 * Uses alpha silhouettes so multi-character cutouts are rejected early.
 */

import sharp from "sharp";
import {
  FigurineBuildError,
  alphaMaskFromRgba,
  extractSilhouettePolygons,
  filterPopoutComponents,
  getSilhouetteStats
} from "@kidar/core";

export type FigurineSubjectInspection = {
  width: number;
  height: number;
  componentCount: number;
  coverage: number;
};

export async function inspectFigurineSubject(
  bytes: Uint8Array
): Promise<FigurineSubjectInspection> {
  let width: number;
  let height: number;
  let rgba: Buffer;
  try {
    const decoded = await sharp(Buffer.from(bytes))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    width = decoded.info.width;
    height = decoded.info.height;
    rgba = decoded.data;
  } catch {
    throw new FigurineBuildError("Could not decode figurine subject image", {
      retryable: false,
      code: "SOURCE_DECODE"
    });
  }

  const mask = alphaMaskFromRgba(width, height, new Uint8ClampedArray(rgba));
  const polygons = extractSilhouettePolygons(mask, {
    cleanupRadius: Math.max(1, Math.round(Math.min(width, height) / 800)),
    simplifyEpsilon: 0.006,
    minComponentPixels: Math.max(12, Math.floor(width * height * 0.00015))
  });
  const filtered = filterPopoutComponents(polygons);
  const stats = getSilhouetteStats(mask, filtered.length ? filtered : polygons);

  return {
    width,
    height,
    componentCount: filtered.length,
    coverage: stats.coverage
  };
}
