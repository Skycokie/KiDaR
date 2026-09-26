import { describe, expect, it } from "vitest";
import {
  shouldHeroSpin,
  starlitEmergeAmount,
  starlitEmergePose,
  starlitNextPhase
} from "./starlit-emerge";

describe("starlit emerge", () => {
  it("starts inside the photo and eases out", () => {
    expect(starlitEmergeAmount(0, false)).toBe(0);
    const mid = starlitEmergeAmount(1.6, false);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
    expect(starlitEmergeAmount(3.2, false)).toBe(1);
    expect(starlitEmergeAmount(8, false)).toBe(1);
  });

  it("shows the emerged pose immediately when motion is reduced", () => {
    expect(starlitEmergeAmount(0, true)).toBe(1);
    expect(starlitEmergePose(1, 0).tilt).toBeGreaterThan(starlitEmergePose(0, 0).tilt);
    expect(starlitEmergePose(1, 0).forward).toBeGreaterThan(starlitEmergePose(0, 0).forward);
  });

  it("opens only from the photo and returns only from the scene", () => {
    expect(starlitNextPhase("hidden", "photo")).toBe("emerging");
    expect(starlitNextPhase("hidden", "scene")).toBe("hidden");
    expect(starlitNextPhase("emerging", "photo")).toBe("emerging");
    expect(starlitNextPhase("out", "scene")).toBe("returning");
    expect(starlitNextPhase("out", "photo")).toBe("out");
    expect(starlitNextPhase("returning", "photo")).toBe("returning");
  });

  it("spins the yellow detective only once the scene is out", () => {
    expect(shouldHeroSpin("out")).toBe(true);
    expect(shouldHeroSpin("hidden")).toBe(false);
    expect(shouldHeroSpin("emerging")).toBe(false);
    expect(shouldHeroSpin("returning")).toBe(false);
  });
});
