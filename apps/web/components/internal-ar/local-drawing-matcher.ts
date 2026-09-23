/**
 * Conservative browser-only drawing similarity (NCC on downscaled grayscale).
 * No network I/O. Does not claim a match without score + consecutive-frame stability.
 */

export const MATCHER_TARGET_SIZE = 160;
/** Conservative: require a strong normalized correlation. */
export const MATCHER_SCORE_THRESHOLD = 0.82;
/** Consecutive frames above threshold before unlocking. */
export const MATCHER_STABLE_FRAMES = 7;

export type GrayFrame = {
  width: number;
  height: number;
  /** Length = width * height, values 0–255 */
  pixels: Float32Array;
};

export type MatcherStability = {
  streak: number;
  matched: boolean;
  lastScore: number;
};

export function createMatcherStability(): MatcherStability {
  return { streak: 0, matched: false, lastScore: 0 };
}

export function pushMatcherScore(
  prev: MatcherStability,
  score: number,
  threshold = MATCHER_SCORE_THRESHOLD,
  need = MATCHER_STABLE_FRAMES
): MatcherStability {
  const above = Number.isFinite(score) && score >= threshold;
  const streak = above ? prev.streak + 1 : 0;
  return {
    streak,
    matched: streak >= need,
    lastScore: score
  };
}

/** Convert RGBA into a square-ish grayscale float buffer (mean luminance). */
export function rgbaToGrayFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  targetSize = MATCHER_TARGET_SIZE
): GrayFrame {
  const scale = Math.min(1, targetSize / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const pixels = new Float32Array(w * h);

  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) / scale));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) / scale));
      const i = (sy * width + sx) * 4;
      const r = rgba[i] ?? 0;
      const g = rgba[i + 1] ?? 0;
      const b = rgba[i + 2] ?? 0;
      pixels[y * w + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return { width: w, height: h, pixels };
}

/**
 * Normalized cross-correlation in [-1, 1] after mean subtraction.
 * Frames must share the same dimensions (caller downscales both).
 */
export function normalizedCrossCorrelation(a: GrayFrame, b: GrayFrame): number {
  if (a.width !== b.width || a.height !== b.height || a.pixels.length !== b.pixels.length) {
    return 0;
  }
  const n = a.pixels.length;
  if (n === 0) return 0;

  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i += 1) {
    meanA += a.pixels[i]!;
    meanB += b.pixels[i]!;
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a.pixels[i]! - meanA;
    const db = b.pixels[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den < 1e-6) return 0;
  return num / den;
}

/** Score camera crop vs reference; both already GrayFrame at same size preferred. */
export function scoreDrawingMatch(reference: GrayFrame, sample: GrayFrame): number {
  if (reference.width === sample.width && reference.height === sample.height) {
    return normalizedCrossCorrelation(reference, sample);
  }
  // Resample sample into reference dimensions via nearest-neighbor on gray.
  const resized: GrayFrame = {
    width: reference.width,
    height: reference.height,
    pixels: new Float32Array(reference.width * reference.height)
  };
  for (let y = 0; y < reference.height; y += 1) {
    const sy = Math.min(
      sample.height - 1,
      Math.floor((y / reference.height) * sample.height)
    );
    for (let x = 0; x < reference.width; x += 1) {
      const sx = Math.min(
        sample.width - 1,
        Math.floor((x / reference.width) * sample.width)
      );
      resized.pixels[y * reference.width + x] = sample.pixels[sy * sample.width + sx]!;
    }
  }
  return normalizedCrossCorrelation(reference, resized);
}
