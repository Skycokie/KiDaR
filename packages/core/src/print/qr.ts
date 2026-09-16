/**
 * QR PNG generator for absolute public AR page URLs (M4.4a).
 * Pure local bytes — no uploads, no hardcoded domains.
 */

import QRCode from "qrcode";
import { assertPublicAbsoluteUrl, PublicUrlError } from "../public-url";

export class QrGenerateError extends Error {
  readonly code: string;

  constructor(message: string, code = "QR_GENERATE_FAILED") {
    super(message);
    this.name = "QrGenerateError";
    this.code = code;
  }
}

export interface GenerateArQrPngOptions {
  /** Allow http(s) localhost / 127.0.0.1 / ::1 for tests. */
  allowLocalOrigins?: boolean;
  /** PNG edge length in pixels (default 512). */
  size?: number;
  /** Quiet-zone modules (default 2). */
  margin?: number;
}

/**
 * Generate a QR code PNG for a caller-provided absolute public AR URL.
 */
export async function generateArQrPng(
  arPageUrl: string,
  options: GenerateArQrPngOptions = {}
): Promise<Uint8Array> {
  let href: string;
  try {
    href = assertPublicAbsoluteUrl(arPageUrl, {
      allowLocalOrigins: options.allowLocalOrigins,
      label: "arPageUrl"
    }).href;
  } catch (error) {
    if (error instanceof PublicUrlError) {
      throw new QrGenerateError(error.message, error.code);
    }
    throw error;
  }

  const size = options.size ?? 512;
  const margin = options.margin ?? 2;
  if (!Number.isInteger(size) || size < 64 || size > 2048) {
    throw new QrGenerateError("size must be an integer in [64, 2048]", "INVALID_SIZE");
  }
  if (!Number.isInteger(margin) || margin < 0 || margin > 8) {
    throw new QrGenerateError("margin must be an integer in [0, 8]", "INVALID_MARGIN");
  }

  try {
    const buffer = await QRCode.toBuffer(href, {
      type: "png",
      errorCorrectionLevel: "M",
      margin,
      width: size,
      color: { dark: "#000000", light: "#ffffff" }
    });
    return new Uint8Array(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new QrGenerateError(`QR encode failed: ${message}`, "ENCODE_FAILED");
  }
}
