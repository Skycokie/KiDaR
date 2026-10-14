import { describe, expect, it } from "vitest";
import {
  GLB_ORBIT_PITCH_MAX,
  clampGlbOrbitPitch,
  glbOrbitFromPointer
} from "./glb-orbit";

describe("shared GLB pointer orbit helper", () => {
  it("maps pointer travel onto yaw and clamped pitch", () => {
    expect(glbOrbitFromPointer(10, 0).yaw).toBeGreaterThan(0);
    expect(glbOrbitFromPointer(0, 10).pitch).toBeGreaterThan(0);
    expect(clampGlbOrbitPitch(10)).toBeCloseTo(GLB_ORBIT_PITCH_MAX);
    expect(clampGlbOrbitPitch(-10)).toBeCloseTo(-GLB_ORBIT_PITCH_MAX);
  });

  it("does not define network, AR, or publish side effects", () => {
    const source = [
      glbOrbitFromPointer.toString(),
      clampGlbOrbitPitch.toString()
    ].join("\n");
    expect(source).not.toMatch(/fetch|getUserMedia|publish|meshy/i);
  });
});
