import { describe, expect, it } from "vitest";
import { POPOUT_RISE_SECONDS, POPOUT_SPIN_SECONDS, popoutSpinSettled, popoutSpinYaw } from "./popout-turn";

describe("homepage pop-out turn", () => {
  it("stays facing forward while the figure is still stepping out", () => {
    expect(popoutSpinYaw(0)).toBe(0);
    expect(popoutSpinYaw(POPOUT_RISE_SECONDS)).toBe(0);
    expect(popoutSpinSettled(POPOUT_RISE_SECONDS)).toBe(false);
  });

  it("completes one full turn, then reports settled", () => {
    const mid = popoutSpinYaw(POPOUT_RISE_SECONDS + POPOUT_SPIN_SECONDS / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(Math.PI * 2);
    expect(popoutSpinYaw(POPOUT_RISE_SECONDS + POPOUT_SPIN_SECONDS)).toBeCloseTo(Math.PI * 2);
    expect(popoutSpinSettled(POPOUT_RISE_SECONDS + POPOUT_SPIN_SECONDS)).toBe(true);
  });
});
