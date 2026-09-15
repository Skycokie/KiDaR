import { describe, expect, it } from "vitest";
import { extractSilhouettePolygons, getSilhouetteStats, type AlphaMask } from "./sticker-geometry";

function rectangleMask(width: number, height: number, left: number, top: number, right: number, bottom: number): AlphaMask {
  const data = new Uint8Array(width * height);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) data[y * width + x] = 255;
  }
  return { width, height, data };
}

describe("sticker silhouette geometry", () => {
  it("extracts foreground bounds instead of a full-image quad", () => {
    const mask = rectangleMask(20, 20, 6, 5, 14, 15);
    const polygons = extractSilhouettePolygons(mask, { cleanupRadius: 0, simplifyEpsilon: 0 });
    const stats = getSilhouetteStats(mask, polygons);

    expect(stats.coverage).toBe(0.2);
    expect(stats.vertexCount).toBeLessThan(20);
    expect(stats.bounds.minX).toBeCloseTo(-0.2);
    expect(stats.bounds.maxX).toBeCloseTo(0.2);
    expect(stats.bounds.minY).toBeCloseTo(-0.25);
    expect(stats.bounds.maxY).toBeCloseTo(0.25);
  });

  it("removes isolated alpha noise while retaining the main object", () => {
    const mask = rectangleMask(20, 20, 6, 5, 14, 15);
    mask.data[0] = 255;
    mask.data[19] = 255;
    const polygons = extractSilhouettePolygons(mask, { cleanupRadius: 1 });

    expect(polygons).toHaveLength(1);
    expect(polygons[0].area).toBeGreaterThan(0.03);
  });
});
