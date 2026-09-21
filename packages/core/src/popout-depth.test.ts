import { describe, expect, it } from "vitest";
import {
  assignPopoutDepthLayers,
  filterPopoutComponents,
  scorePopoutDepth
} from "./popout-depth";
import type { StickerPolygon } from "./sticker-geometry";

function poly(area: number, x: number, y: number): StickerPolygon {
  return {
    area,
    points: [
      { x: x - 0.05, y: y - 0.05 },
      { x: x + 0.05, y: y - 0.05 },
      { x: x + 0.05, y: y + 0.05 },
      { x: x - 0.05, y: y + 0.05 }
    ]
  };
}

describe("popout depth layers", () => {
  it("keeps a single component at z=0 (safe fallback)", () => {
    const layers = assignPopoutDepthLayers([poly(0.2, 0, -0.2)]);
    expect(layers).toHaveLength(1);
    expect(layers[0].z).toBe(0);
  });

  it("assigns discrete forward Z to lower / larger pieces", () => {
    const layers = assignPopoutDepthLayers([
      poly(0.05, 0.2, 0.3), // small, top-right → back
      poly(0.18, -0.2, -0.25), // large, bottom-left → front
      poly(0.1, 0.05, -0.05) // mid
    ]);
    expect(layers.length).toBe(3);
    const zs = new Set(layers.map((item) => item.z));
    expect(zs.size).toBeGreaterThan(1);
    expect(Math.max(...layers.map((item) => item.z))).toBeGreaterThan(0);
    const front = layers.reduce((best, item) => (item.z > best.z ? item : best));
    expect(front.polygon.area).toBe(0.18);
  });

  it("filters tiny speckles relative to the main silhouette", () => {
    const kept = filterPopoutComponents([poly(0.2, 0, 0), poly(0.0001, 0.4, 0.4)]);
    expect(kept).toHaveLength(1);
    expect(kept[0].area).toBe(0.2);
  });

  it("scores bottom-of-frame higher than top-of-frame", () => {
    const bottom = scorePopoutDepth(poly(0.1, 0, -0.3), 0.1);
    const top = scorePopoutDepth(poly(0.1, 0, 0.3), 0.1);
    expect(bottom).toBeGreaterThan(top);
  });
});
