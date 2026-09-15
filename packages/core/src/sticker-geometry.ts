export interface AlphaMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface StickerPolygon {
  points: Array<{ x: number; y: number }>;
  area: number;
}

export interface SilhouetteStats {
  coverage: number;
  vertexCount: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function indexOf(width: number, x: number, y: number) {
  return y * width + x;
}

function isForeground(mask: AlphaMask, x: number, y: number) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < mask.width &&
    y < mask.height &&
    mask.data[indexOf(mask.width, x, y)] > 0
  );
}

function morphology(mask: AlphaMask, radius: number, operation: "erode" | "dilate") {
  const output = new Uint8Array(mask.data.length);
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      let matches = operation === "erode";
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (ox * ox + oy * oy > radius * radius) continue;
          const foreground = isForeground(mask, x + ox, y + oy);
          if (operation === "erode" && !foreground) {
            matches = false;
            break;
          }
          if (operation === "dilate" && foreground) {
            matches = true;
            break;
          }
        }
        if ((operation === "erode" && !matches) || (operation === "dilate" && matches)) break;
      }
      output[indexOf(mask.width, x, y)] = matches ? 255 : 0;
    }
  }
  return { ...mask, data: output };
}

export function cleanAlphaMask(mask: AlphaMask, radius = 1): AlphaMask {
  // Opening removes isolated pixels; closing fills tiny pinholes/gaps.
  const opened = morphology(morphology(mask, radius, "erode"), radius, "dilate");
  return morphology(morphology(opened, radius, "dilate"), radius, "erode");
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function simplify(
  points: Array<{ x: number; y: number }>,
  epsilon: number
): Array<{ x: number; y: number }> {
  if (points.length < 4) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let split = -1;
  let maxDistance = epsilon;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const denominator = dx * dx + dy * dy;

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const projection =
      denominator === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / denominator));
    const distance = Math.hypot(point.x - (first.x + projection * dx), point.y - (first.y + projection * dy));
    if (distance > maxDistance) {
      maxDistance = distance;
      split = index;
    }
  }

  if (split === -1) return [first, last];
  return [
    ...simplify(points.slice(0, split + 1), epsilon),
    ...simplify(points.slice(split), epsilon).slice(1)
  ];
}

type GridPoint = { x: number; y: number };

function key(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

function traceComponent(mask: AlphaMask, component: Set<number>): GridPoint[] {
  const edges = new Map<string, GridPoint[]>();
  const addEdge = (from: GridPoint, to: GridPoint) => {
    const list = edges.get(key(from)) ?? [];
    list.push(to);
    edges.set(key(from), list);
  };

  for (const cell of component) {
    const x = cell % mask.width;
    const y = Math.floor(cell / mask.width);
    if (!component.has(indexOf(mask.width, x, y - 1))) addEdge({ x, y }, { x: x + 1, y });
    if (!component.has(indexOf(mask.width, x + 1, y))) addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
    if (!component.has(indexOf(mask.width, x, y + 1))) addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
    if (!component.has(indexOf(mask.width, x - 1, y))) addEdge({ x, y: y + 1 }, { x, y });
  }

  const start = edges.keys().next().value as string | undefined;
  if (!start) return [];
  const [startX, startY] = start.split(":").map(Number);
  const points: GridPoint[] = [{ x: startX, y: startY }];
  let current = points[0];
  const maxSteps = edges.size + 1;

  for (let step = 0; step < maxSteps; step += 1) {
    const next = edges.get(key(current))?.shift();
    if (!next) break;
    if (next.x === points[0].x && next.y === points[0].y) break;
    points.push(next);
    current = next;
  }
  return points;
}

export function extractSilhouettePolygons(
  mask: AlphaMask,
  options: { cleanupRadius?: number; simplifyEpsilon?: number; minComponentPixels?: number } = {}
): StickerPolygon[] {
  const cleaned = cleanAlphaMask(mask, options.cleanupRadius ?? 1);
  const visited = new Uint8Array(cleaned.data.length);
  const polygons: StickerPolygon[] = [];
  const minimum = options.minComponentPixels ?? Math.max(4, Math.floor(mask.width * mask.height * 0.0002));

  for (let y = 0; y < cleaned.height; y += 1) {
    for (let x = 0; x < cleaned.width; x += 1) {
      const startIndex = indexOf(cleaned.width, x, y);
      if (visited[startIndex] || !isForeground(cleaned, x, y)) continue;

      const component = new Set<number>();
      const queue = [startIndex];
      visited[startIndex] = 1;
      while (queue.length) {
        const cell = queue.pop()!;
        component.add(cell);
        const cellX = cell % cleaned.width;
        const cellY = Math.floor(cell / cleaned.width);
        for (const [nextX, nextY] of [
          [cellX - 1, cellY],
          [cellX + 1, cellY],
          [cellX, cellY - 1],
          [cellX, cellY + 1]
        ]) {
          if (nextX < 0 || nextY < 0 || nextX >= cleaned.width || nextY >= cleaned.height) continue;
          const nextIndex = indexOf(cleaned.width, nextX, nextY);
          if (!visited[nextIndex] && isForeground(cleaned, nextX, nextY)) {
            visited[nextIndex] = 1;
            queue.push(nextIndex);
          }
        }
      }

      if (component.size < minimum) continue;
      const traced = traceComponent(cleaned, component);
      const points = simplify(
        traced.map((point) => ({
          x: point.x / cleaned.width - 0.5,
          y: 0.5 - point.y / cleaned.height
        })),
        options.simplifyEpsilon ?? 0.008
      );
      if (points.length >= 3) polygons.push({ points, area: polygonArea(points) });
    }
  }

  return polygons.sort((left, right) => right.area - left.area);
}

export function getSilhouetteStats(mask: AlphaMask, polygons: StickerPolygon[]): SilhouetteStats {
  const foregroundPixels = mask.data.reduce((sum, alpha) => sum + (alpha > 0 ? 1 : 0), 0);
  const points = polygons.flatMap((polygon) => polygon.points);
  if (!points.length) {
    return {
      coverage: foregroundPixels / (mask.width * mask.height),
      vertexCount: 0,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    };
  }
  return {
    coverage: foregroundPixels / (mask.width * mask.height),
    vertexCount: points.length,
    bounds: {
      minX: Math.min(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxX: Math.max(...points.map((point) => point.x)),
      maxY: Math.max(...points.map((point) => point.y))
    }
  };
}

export function alphaMaskFromRgba(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  alphaThreshold = 24
): AlphaMask {
  const data = new Uint8Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    const alpha = rgba[index * 4 + 3];
    data[index] = alpha >= alphaThreshold ? alpha : 0;
  }
  return { width, height, data };
}
