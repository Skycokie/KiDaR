import { describe, expect, it } from "vitest";
import { POPOUT_DEPTH_LEVELS, type StickerPolygon } from "@kidar/core";
import {
  decidePreviewPopout,
  previewLayerZ,
  previewVolumeDepth
} from "./popout-preview-normalize";

function poly(area: number, y: number): StickerPolygon {
  return {
    area,
    points: [
      { x: -0.1, y },
      { x: 0.1, y },
      { x: 0, y: y - 0.08 }
    ]
  };
}

describe("preview pop-out normalization", () => {
  it("sends an empty or invalid mask to fallback and never a layer list", () => {
    expect(decidePreviewPopout([], 0.2)).toEqual({ kind: "fallback", reason: "empty" });
    expect(decidePreviewPopout(null, 0.4)).toEqual({ kind: "fallback", reason: "empty" });
    expect(decidePreviewPopout([poly(0.2, 0)], Number.NaN)).toEqual({
      kind: "fallback",
      reason: "empty"
    });
  });

  it("refuses a near-full-page mask so the photograph is not extruded as a rectangle", () => {
    expect(decidePreviewPopout([poly(0.8, 0)], 0.94)).toEqual({
      kind: "fallback",
      reason: "full-page"
    });
  });

  it("drops tiny components and keeps deterministic core depth layers", () => {
    const polygons = [poly(0.42, -0.35), poly(0.36, 0.32), poly(0.00001, 0.1)];
    const first = decidePreviewPopout(polygons, 0.28);
    const second = decidePreviewPopout(polygons, 0.28);
    expect(first.kind).toBe("layers");
    expect(second).toEqual(first);
    if (first.kind !== "layers") return;
    expect(first.layers).toHaveLength(2);
    for (const layer of first.layers) {
      expect(POPOUT_DEPTH_LEVELS).toContain(layer.z);
    }
    const zs = first.layers.map((layer) => layer.z);
    expect(new Set(zs).size).toBeGreaterThan(1);
  });

  it("maps Volum only onto extrusion depth and layer separation", () => {
    const low = previewVolumeDepth(8);
    const high = previewVolumeDepth(92);
    expect(high.depth).toBeGreaterThan(low.depth);
    expect(high.zScale).toBeGreaterThan(low.zScale);
    expect(previewLayerZ(0.06, 92)).toBeGreaterThan(previewLayerZ(0.06, 8));
    expect(previewLayerZ(0, 100)).toBe(0);
    const layers = decidePreviewPopout([poly(0.4, -0.2), poly(0.3, 0.25)], 0.22);
    expect(layers.kind).toBe("layers");
  });
});
