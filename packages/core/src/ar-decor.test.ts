import { describe, expect, it } from "vitest";
import {
  AR_DECOR_MAX,
  decorHashIdentity,
  normalizeArDecorList,
  resolveArDecorProps,
  stagePercentToMarkerPosition,
  studioDecorToArProps
} from "./ar-decor";

describe("ar-decor", () => {
  it("maps stage percent to marker meters with inverted Y", () => {
    expect(stagePercentToMarkerPosition(50, 50)).toEqual({ x: 0, y: 0, z: 0.05 });
    const corner = stagePercentToMarkerPosition(0, 100);
    expect(corner.x).toBeLessThan(0);
    expect(corner.y).toBeLessThan(0);
  });

  it("keeps only known ids and caps length", () => {
    const list = normalizeArDecorList([
      { id: "stars", x: 20, y: 30, yaw: 10, pitch: -5 },
      { id: "nope", x: 1, y: 1, yaw: 0, pitch: 0 },
      ...Array.from({ length: 20 }, () => ({ id: "tree", x: 50, y: 50, yaw: 0, pitch: 0 }))
    ]);
    expect(list.every((p) => p.id === "stars" || p.id === "tree")).toBe(true);
    expect(list.length).toBe(AR_DECOR_MAX);
  });

  it("converts Studio radians to degrees and resolves public URLs", () => {
    const props = studioDecorToArProps([{ id: "balloons", x: 80, y: 20, yaw: Math.PI / 4, pitch: 0 }]);
    expect(props[0]?.yaw).toBeCloseTo(45, 5);
    const resolved = resolveArDecorProps({
      decor: props,
      appOrigin: "https://kidar.example"
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.modelUrl).toBe("https://kidar.example/demo/glb/decor/balloons.glb");
    expect(decorHashIdentity(props)).toEqual([
      expect.objectContaining({ id: "balloons" })
    ]);
  });
});
