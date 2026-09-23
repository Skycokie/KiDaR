import { describe, expect, it } from "vitest";
import {
  createMatcherStability,
  MATCHER_SCORE_THRESHOLD,
  MATCHER_STABLE_FRAMES,
  normalizedCrossCorrelation,
  pushMatcherScore,
  rgbaToGrayFrame,
  scoreDrawingMatch,
  type GrayFrame
} from "./local-drawing-matcher";

function solidGray(width: number, height: number, value: number): GrayFrame {
  const pixels = new Float32Array(width * height);
  pixels.fill(value);
  return { width, height, pixels };
}

function gradientGray(width: number, height: number): GrayFrame {
  const pixels = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = (x / Math.max(1, width - 1)) * 255;
    }
  }
  return { width, height, pixels };
}

describe("local-drawing-matcher", () => {
  it("scores identical frames near 1", () => {
    const a = gradientGray(32, 32);
    expect(normalizedCrossCorrelation(a, a)).toBeGreaterThan(0.99);
  });

  it("scores dissimilar frames low", () => {
    const a = gradientGray(32, 32);
    const b = solidGray(32, 32, 128);
    expect(Math.abs(normalizedCrossCorrelation(a, b))).toBeLessThan(0.2);
  });

  it("does not mark match below threshold", () => {
    let stab = createMatcherStability();
    for (let i = 0; i < MATCHER_STABLE_FRAMES + 2; i += 1) {
      stab = pushMatcherScore(stab, MATCHER_SCORE_THRESHOLD - 0.05);
    }
    expect(stab.matched).toBe(false);
    expect(stab.streak).toBe(0);
  });

  it("requires consecutive frames above threshold", () => {
    let stab = createMatcherStability();
    for (let i = 0; i < MATCHER_STABLE_FRAMES - 1; i += 1) {
      stab = pushMatcherScore(stab, MATCHER_SCORE_THRESHOLD + 0.01);
      expect(stab.matched).toBe(false);
    }
    stab = pushMatcherScore(stab, MATCHER_SCORE_THRESHOLD + 0.01);
    expect(stab.matched).toBe(true);
    expect(stab.streak).toBe(MATCHER_STABLE_FRAMES);
  });

  it("resets streak after a low score", () => {
    let stab = createMatcherStability();
    stab = pushMatcherScore(stab, 0.9);
    stab = pushMatcherScore(stab, 0.9);
    stab = pushMatcherScore(stab, 0.1);
    expect(stab.streak).toBe(0);
    expect(stab.matched).toBe(false);
  });

  it("builds gray frames from rgba", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 255;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 255;
    }
    const frame = rgbaToGrayFrame(rgba, 4, 4, 4);
    expect(frame.width).toBe(4);
    expect(frame.height).toBe(4);
    expect(frame.pixels[0]).toBeGreaterThan(50);
  });

  it("scores resized samples against reference", () => {
    const ref = gradientGray(40, 40);
    const sample = gradientGray(20, 20);
    expect(scoreDrawingMatch(ref, sample)).toBeGreaterThan(0.9);
  });
});
