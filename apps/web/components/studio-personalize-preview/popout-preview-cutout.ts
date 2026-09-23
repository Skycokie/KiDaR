"use client";

/**
 * Client-only cutout. Same steps as `createCutout` in
 * `app/studio/[projectId]/three-preview.tsx` — dynamic @imgly + @kidar/core.
 * Never imported from a Server Component.
 */
import {
  alphaMaskFromRgba,
  extractSilhouettePolygons,
  getSilhouetteStats,
  type SilhouetteStats,
  type StickerPolygon
} from "@kidar/core";

export type PreviewCutout = {
  sourceCanvas: HTMLCanvasElement;
  cutoutCanvas: HTMLCanvasElement;
  rgba: Uint8ClampedArray;
  polygons: StickerPolygon[];
  stats: SilhouetteStats;
};

/** Long-edge cap before cutout. Mobile stays at 1024 so the outline is still usable. */
export const MOBILE_POPOUT_MAX_EDGE = 1024;
export const DESKTOP_POPOUT_MAX_EDGE = 2048;
export const MOBILE_POPOUT_BREAKPOINT = 959;

export function fittedEdgeSize(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const longEdge = Math.max(safeWidth, safeHeight);
  if (!(maxEdge > 0) || longEdge <= maxEdge) {
    return { width: safeWidth, height: safeHeight };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale))
  };
}

export function previewProcessMaxEdge(viewportWidth: number): number {
  return viewportWidth <= MOBILE_POPOUT_BREAKPOINT ? MOBILE_POPOUT_MAX_EDGE : DESKTOP_POPOUT_MAX_EDGE;
}

function drawFitted(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const size = fittedEdgeSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas 2D context is unavailable");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare the drawing"));
      },
      "image/jpeg",
      0.92
    );
  });
}

export async function createPreviewCutout(sourceUrl: string): Promise<PreviewCutout> {
  const ort = (await import("onnxruntime-web")) as {
    env: { wasm: { wasmPaths: string } };
    default?: { env: { wasm: { wasmPaths: string } } };
  };
  const runtime = ort.default ?? ort;
  runtime.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
  const { removeBackground } = await import("@imgly/background-removal");

  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error("Could not load source drawing");
  const sourceBlob = await sourceResponse.blob();
  const typedBlob =
    sourceBlob.type && sourceBlob.type !== "application/octet-stream"
      ? sourceBlob
      : new Blob([sourceBlob], { type: "image/jpeg" });

  const maxEdge = previewProcessMaxEdge(window.innerWidth);
  const sourceBitmap = await createImageBitmap(typedBlob, { imageOrientation: "from-image" });
  const sourceCanvas = drawFitted(sourceBitmap, maxEdge);
  const modelBlob = await canvasToJpeg(sourceCanvas);

  const cutoutBlob = await removeBackground(modelBlob, {
    publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/"
  });
  const cutoutBitmap = await createImageBitmap(cutoutBlob);
  const cutoutCanvas = drawFitted(cutoutBitmap, maxEdge);
  const context = cutoutCanvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  const imageData = context.getImageData(0, 0, cutoutCanvas.width, cutoutCanvas.height);
  const mask = alphaMaskFromRgba(cutoutCanvas.width, cutoutCanvas.height, imageData.data);
  const polygons = extractSilhouettePolygons(mask, {
    cleanupRadius: Math.max(1, Math.round(Math.min(cutoutCanvas.width, cutoutCanvas.height) / 700)),
    simplifyEpsilon: 0.0035,
    minComponentPixels: Math.max(10, Math.floor(cutoutCanvas.width * cutoutCanvas.height * 0.00012))
  });
  const stats = getSilhouetteStats(mask, polygons);
  return {
    sourceCanvas,
    cutoutCanvas,
    rgba: imageData.data,
    polygons,
    stats
  };
}
