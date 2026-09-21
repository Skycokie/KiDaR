/**
 * Local edge colors for pop-out side walls — never a global theme accent.
 * Samples inward from the silhouette so brown costumes stay brown, etc.
 */

export type Rgb = { r: number; g: number; b: number };

export type EdgeSampleOptions = {
  /** Pixels to step inward from the contour (default 4). */
  inwardPx?: number;
  /** Max contour samples (default 128). */
  maxSamples?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Normalized silhouette point (−0.5…0.5) → image pixel. */
export function normalizedToPixel(
  point: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: (point.x + 0.5) * width,
    y: (0.5 - point.y) * height
  };
}

function samplePixel(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
  x: number,
  y: number
): { r: number; g: number; b: number; a: number } | null {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return null;
  const i = (py * width + px) * 4;
  return { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2], a: rgba[i + 3] };
}

/**
 * For each contour point, sample pixels toward the polygon centroid (inward).
 * Returns one RGB per sample in contour order.
 */
export function sampleInwardEdgeColors(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
  points: Array<{ x: number; y: number }>,
  options: EdgeSampleOptions = {}
): Rgb[] {
  if (points.length < 3) return [];
  const inwardPx = options.inwardPx ?? 4;
  const maxSamples = options.maxSamples ?? 128;
  const stride = Math.max(1, Math.ceil(points.length / maxSamples));

  let centroidX = 0;
  let centroidY = 0;
  for (const point of points) {
    centroidX += point.x;
    centroidY += point.y;
  }
  centroidX /= points.length;
  centroidY /= points.length;
  const centroidPixel = normalizedToPixel({ x: centroidX, y: centroidY }, width, height);

  const colors: Rgb[] = [];
  for (let index = 0; index < points.length; index += stride) {
    const pixel = normalizedToPixel(points[index], width, height);
    const dx = centroidPixel.x - pixel.x;
    const dy = centroidPixel.y - pixel.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;

    let picked: Rgb | null = null;
    for (let step = 1; step <= inwardPx + 4; step += 1) {
      const sample = samplePixel(width, height, rgba, pixel.x + ux * step, pixel.y + uy * step);
      if (sample && sample.a >= 24) {
        picked = { r: sample.r, g: sample.g, b: sample.b };
        break;
      }
    }
    // If the vertex itself sits on opaque paint, use it.
    if (!picked) {
      const onEdge = samplePixel(width, height, rgba, pixel.x, pixel.y);
      if (onEdge && onEdge.a >= 24) {
        picked = { r: onEdge.r, g: onEdge.g, b: onEdge.b };
      }
    }
    if (picked) colors.push(picked);
  }

  return colors;
}

/** Channel-wise median — stable fallback when a strip is unavailable. */
export function medianRgb(colors: Rgb[]): Rgb {
  if (!colors.length) return { r: 91, g: 70, b: 54 }; // warm neutral #5b4636
  const mid = Math.floor(colors.length / 2);
  const pick = (channel: keyof Rgb) => {
    const sorted = colors.map((c) => c[channel]).sort((a, b) => a - b);
    return sorted[mid] ?? sorted[0];
  };
  return { r: pick("r"), g: pick("g"), b: pick("b") };
}

export function rgbToHex(color: Rgb): string {
  const hex = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/**
 * Narrow RGBA strip (width = samples, height = stripHeight) for ExtrudeGeometry
 * side UVs (u along contour, v across depth).
 */
export function buildEdgeStripRgba(
  colors: Rgb[],
  stripHeight = 8
): { width: number; height: number; data: Uint8ClampedArray } {
  const width = Math.max(1, colors.length);
  const height = Math.max(1, stripHeight);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let x = 0; x < width; x += 1) {
    const color = colors[x] ?? colors[colors.length - 1] ?? { r: 91, g: 70, b: 54 };
    for (let y = 0; y < height; y += 1) {
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
