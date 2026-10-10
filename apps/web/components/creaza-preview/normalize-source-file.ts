/**
 * Convert phone-library images (HEIC / WebP / …) to JPEG so source upload
 * and MindAR compile stay on supported raster types.
 */

import {
  SOURCE_MAX_BYTES,
  isSourceConvertibleMime,
  isSourceRasterMime,
  resolveSourceMime
} from "@/lib/simple-creator";

export type NormalizeSourceResult =
  | { ok: true; file: File; converted: boolean }
  | { ok: false; code: "type" | "size" };

function jpegFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "poza";
  return `${base}.jpg`;
}

async function canvasToJpegFile(source: CanvasImageSource, width: number, height: number, name: string): Promise<File | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.92);
  });
  if (!blob || blob.size > SOURCE_MAX_BYTES) return null;
  return new File([blob], jpegFileName(name), { type: "image/jpeg" });
}

/**
 * Returns a JPEG/PNG File ready for Appwrite source upload.
 * HEIC/WebP and similar phone formats are rasterized when the browser can decode them.
 */
export async function normalizeSourceFile(file: File): Promise<NormalizeSourceResult> {
  if (file.size > SOURCE_MAX_BYTES) return { ok: false, code: "size" };

  const mime = resolveSourceMime(file);
  if (isSourceRasterMime(mime)) {
    return { ok: true, file, converted: false };
  }
  if (!isSourceConvertibleMime(mime) && mime !== "") {
    return { ok: false, code: "type" };
  }

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      try {
        const next = await canvasToJpegFile(bitmap, bitmap.width, bitmap.height, file.name);
        if (next) return { ok: true, file: next, converted: true };
      } finally {
        bitmap.close();
      }
    }
  } catch {
    // Fall through to <img> decode path.
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const dims = await new Promise<{ width: number; height: number; img: HTMLImageElement }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, img });
        img.onerror = () => reject(new Error("decode-failed"));
        img.src = objectUrl;
      });
      const next = await canvasToJpegFile(dims.img, dims.width, dims.height, file.name);
      if (next) return { ok: true, file: next, converted: true };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return { ok: false, code: "type" };
  }

  return { ok: false, code: "type" };
}
