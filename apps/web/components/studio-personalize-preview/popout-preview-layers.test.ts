import { describe, expect, it } from "vitest";
import {
  FIXTURE_POPOUT_PARTS,
  POPOUT_EDGE_COLORS,
  PREVIEW_POPOUT_DEPTH_LEVELS,
  figurinePuff,
  figurineVolumeScale,
  popoutExtrusionPx,
  popoutLayerOffsetsPx
} from "./popout-preview-layers";

describe("preview pop-out layer helpers", () => {
  it("uses the same discrete depth steps as the production popout design", () => {
    expect([...PREVIEW_POPOUT_DEPTH_LEVELS]).toEqual([0, 0.02, 0.04, 0.06]);
  });

  it("scales extrusion depth with local Volum only", () => {
    expect(popoutExtrusionPx(0)).toBeLessThan(popoutExtrusionPx(50));
    expect(popoutExtrusionPx(50)).toBeLessThan(popoutExtrusionPx(100));
    const low = popoutLayerOffsetsPx(20);
    const high = popoutLayerOffsetsPx(90);
    expect(high[high.length - 1]!).toBeGreaterThan(low[low.length - 1]!);
  });

  it("makes figurine Volum steeper than pop-out paper lift", () => {
    const popSpan = 0.72 + 100 / 180 - (0.72 + 0 / 180);
    const figSpan = figurineVolumeScale(100) - figurineVolumeScale(0);
    expect(figSpan).toBeGreaterThan(popSpan);
    expect(figurinePuff(90)).toBeGreaterThan(figurinePuff(20));
    expect(figurineVolumeScale(62)).toBeGreaterThan(0.72 + 62 / 180);
  });

  it("keeps warm paper edge colors and multi-part fixture layers", () => {
    expect(POPOUT_EDGE_COLORS.warm).not.toMatch(/blue|#00|#3b82f6/i);
    expect(FIXTURE_POPOUT_PARTS.map((part) => part.id)).toEqual([
      "legs",
      "torso",
      "arms",
      "head"
    ]);
  });
});
