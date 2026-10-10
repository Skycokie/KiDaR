/**
 * Browser-memory source image for `/creaza-preview` only.
 * Never uploads — Object URLs must be revoked by the caller/shell.
 */

import { resolveSourceMime, validateSourceImage } from "@/lib/simple-creator";
import { normalizeSourceFile } from "./normalize-source-file";

export type LocalSourceImage = {
  file: File;
  objectUrl: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

export type LocalSourceBuildResult =
  | { ok: true; image: LocalSourceImage; smallWarning: boolean }
  | { ok: false; code: "type" | "size" };

export function revokeLocalSourceImage(image: LocalSourceImage | null | undefined): void {
  if (image?.objectUrl) {
    URL.revokeObjectURL(image.objectUrl);
  }
}

function readImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = objectUrl;
  });
}

/**
 * Validate + create an in-memory preview URL.
 * Converts HEIC/WebP from phone libraries to JPEG when needed.
 * Does not touch the network.
 */
export async function buildLocalSourceImage(file: File): Promise<LocalSourceBuildResult> {
  const normalized = await normalizeSourceFile(file);
  if (!normalized.ok) {
    return { ok: false, code: normalized.code };
  }

  const ready = normalized.file;
  const validation = validateSourceImage(ready);
  if (!validation.ok) {
    return { ok: false, code: validation.code ?? "type" };
  }

  const objectUrl = URL.createObjectURL(ready);
  const mimeType = resolveSourceMime(ready) || "image/jpeg";

  let width: number | undefined;
  let height: number | undefined;
  try {
    const dims = await readImageDimensions(objectUrl);
    width = dims.width;
    height = dims.height;
  } catch {
    // Dimensions are optional for acceptance; type/size already validated.
  }

  return {
    ok: true,
    smallWarning: validation.small,
    image: {
      file: ready,
      objectUrl,
      name: ready.name || "poza.jpg",
      mimeType,
      sizeBytes: ready.size,
      width,
      height
    }
  };
}

export function pickFirstImageFile(list: FileList | null | undefined): File | null {
  if (!list || list.length === 0) return null;
  return list.item(0);
}
