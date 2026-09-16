import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";
import { createCutoutFromRgba, type CutoutResult } from "./cutout-rgba";

/**
 * Node-compatible cutout: @imgly/background-removal-node + sharp decode.
 * Kept in a separate module so unit tests can avoid loading native ONNX/sharp.
 */
export async function createCutoutFromBytes(sourceBytes: Uint8Array): Promise<CutoutResult> {
  const blob = new Blob([Buffer.from(sourceBytes)], { type: "image/jpeg" });
  const cutoutBlob = await removeBackground(blob);
  const cutoutBuffer = Buffer.from(await cutoutBlob.arrayBuffer());
  const { data, info } = await sharp(cutoutBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return createCutoutFromRgba(width, height, rgba);
}
