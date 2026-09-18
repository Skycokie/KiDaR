import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import {
  CREATOR_PRESETS,
  friendlySurpriseName,
  isSimpleCreatorPreset,
  technicalModeForPreset
} from "./simple-creator";

describe("friendlySurpriseName", () => {
  it("uses locale month names for the provided date, not a hardcoded calendar string", () => {
    const march = friendlySurpriseName(new Date(2026, 2, 5), "ro-RO");
    const november = friendlySurpriseName(new Date(2026, 10, 1), "ro-RO");
    expect(march).toMatch(/^Surpriza din /);
    expect(march).toContain("5");
    expect(march.toLowerCase()).toContain("martie");
    expect(november).toContain("1");
    expect(november.toLowerCase()).toContain("noiembrie");
    expect(march).not.toBe(november);
    expect(march).not.toBe("Surpriza din 18 septembrie");
  });
});

describe("preset mapping", () => {
  it("keeps the technical pipeline on popout for every Simple Creator preset", () => {
    for (const preset of CREATOR_PRESETS) {
      expect(technicalModeForPreset(preset)).toBe("popout");
      expect(isSimpleCreatorPreset(preset)).toBe(true);
    }
    expect(isSimpleCreatorPreset("studio")).toBe(false);
    expect(isSimpleCreatorPreset("popout")).toBe(false);
  });
});

describe("Simple Creator contrast tokens", () => {
  it("meets AA for ink, accent, and danger on paper", () => {
    expect(contrastRatio("#1B1726", "#F7F4EE")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FFFFFF", "#5B4FE0")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#9B1C2C", "#F7F4EE")).toBeGreaterThanOrEqual(4.5);
  });
});
