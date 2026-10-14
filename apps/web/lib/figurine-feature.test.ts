import { describe, expect, it } from "vitest";
import { isFigurineFeatureEnabled } from "./figurine-feature";

describe("isFigurineFeatureEnabled", () => {
  it("accepts FIGURE_GENERATION_ENABLED=true", () => {
    expect(isFigurineFeatureEnabled({ FIGURE_GENERATION_ENABLED: "true" })).toBe(true);
  });

  it("accepts FIGURINE_3D_ENABLED true/1 as the same gate", () => {
    expect(isFigurineFeatureEnabled({ FIGURINE_3D_ENABLED: "true" })).toBe(true);
    expect(isFigurineFeatureEnabled({ FIGURINE_3D_ENABLED: "1" })).toBe(true);
    expect(isFigurineFeatureEnabled({ FIGURINE_3D_ENABLED: "yes" })).toBe(false);
  });

  it("stays off when unset", () => {
    expect(isFigurineFeatureEnabled({})).toBe(false);
  });
});
