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

function drawBitmap(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
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

  const sourceBitmap = await createImageBitmap(typedBlob);
  const sourceCanvas = drawBitmap(sourceBitmap);

  const cutoutBlob = await removeBackground(typedBlob, {
    publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/"
  });
  const cutoutBitmap = await createImageBitmap(cutoutBlob);
  const cutoutCanvas = drawBitmap(cutoutBitmap);
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
