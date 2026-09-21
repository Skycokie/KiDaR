import { describe, expect, it } from "vitest";
import {
  buildEdgeStripRgba,
  medianRgb,
  normalizedToPixel,
  rgbToHex,
  sampleInwardEdgeColors
} from "./popout-edge-color";

function paintOpaque(
  width: number,
  height: number,
  fill: { r: number; g: number; b: number },
  left: number,
  top: number,
  right: number,
  bottom: number
) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = fill.r;
      rgba[i + 1] = fill.g;
      rgba[i + 2] = fill.b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

describe("popout edge color sampling", () => {
  it("maps normalized center to image center", () => {
    expect(normalizedToPixel({ x: 0, y: 0 }, 100, 80)).toEqual({ x: 50, y: 40 });
  });

  it("samples inward browns instead of a theme blue", () => {
    const rgba = paintOpaque(40, 40, { r: 140, g: 70, b: 40 }, 10, 10, 30, 30);
    const square = [
      { x: -0.25, y: 0.25 },
      { x: 0.25, y: 0.25 },
      { x: 0.25, y: -0.25 },
      { x: -0.25, y: -0.25 }
    ];
    const colors = sampleInwardEdgeColors(40, 40, rgba, square, { inwardPx: 3, maxSamples: 16 });
    expect(colors.length).toBeGreaterThan(0);
    const median = medianRgb(colors);
    expect(median.r).toBeGreaterThan(100);
    expect(median.b).toBeLessThan(80);
    expect(rgbToHex(median)).not.toMatch(/^#6d5dfc$/i);
  });

  it("builds an opaque edge strip from contour colors", () => {
    const strip = buildEdgeStripRgba(
      [
        { r: 20, g: 20, b: 20 },
        { r: 200, g: 80, b: 40 }
      ],
      4
    );
    expect(strip.width).toBe(2);
    expect(strip.height).toBe(4);
    expect(strip.data[0]).toBe(20);
    expect(strip.data[4]).toBe(200);
    expect(strip.data[7]).toBe(255);
  });

  it("falls back to warm neutral when no samples exist", () => {
    expect(rgbToHex(medianRgb([]))).toBe("#5b4636");
  });
});
