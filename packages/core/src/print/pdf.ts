/**
 * A4 print PDF generator: source drawing + QR + Romanian instruction (M4.4a).
 * Embeds image bytes only — never source URLs.
 */

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { detectSupportedSourceImageMime } from "../mind";

export class PrintPdfError extends Error {
  readonly code: string;

  constructor(message: string, code = "PDF_GENERATE_FAILED") {
    super(message);
    this.name = "PrintPdfError";
    this.code = code;
  }
}

export type PrintImageMime = "image/png" | "image/jpeg";

export interface GenerateA4PrintPdfInput {
  /** Source drawing bytes (PNG or JPEG). */
  sourceImageBytes: Uint8Array;
  /** Declared MIME; must match magic bytes. */
  sourceMimeType: PrintImageMime;
  /** QR PNG bytes from {@link generateArQrPng}. */
  qrPngBytes: Uint8Array;
  /** Exactly one Romanian instruction line shown on the page. */
  instructionLine: string;
  /** Free-tier watermark when whitelabel is unavailable. */
  showWatermark?: boolean;
}

export const DEFAULT_PRINT_INSTRUCTION_RO =
  "Scaneaza codul QR cu telefonul pentru a vedea desenul in realitate augmentata.";
export const PRINT_WATERMARK_RO = "Creat cu kidAR Studio - plan gratuit";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 36;
const QR_SIZE = 108;
const INSTRUCTION_MAX = 160;

/**
 * Helvetica (WinAnsi) cannot encode Romanian diacritics (ă, â, î, ș, ț).
 * Fold to ASCII-compatible Latin so a single instruction line still prints.
 */
export function toPdfWinAnsiText(value: string): string {
  return value
    .replace(/[ăâ]/g, "a")
    .replace(/[ĂÂ]/g, "A")
    .replace(/î/g, "i")
    .replace(/Î/g, "I")
    .replace(/[șş]/g, "s")
    .replace(/[ȘŞ]/g, "S")
    .replace(/[țţ]/g, "t")
    .replace(/[ȚŢ]/g, "T")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function assertPng(bytes: Uint8Array, label: string): void {
  if (
    bytes.byteLength < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    throw new PrintPdfError(`${label} must be a PNG`, "INVALID_QR_PNG");
  }
}

/**
 * Build an A4 portrait PDF with centered drawing, lower-right QR, and one instruction line.
 */
export async function generateA4PrintPdf(input: GenerateA4PrintPdfInput): Promise<Uint8Array> {
  if (!input.sourceImageBytes || input.sourceImageBytes.byteLength === 0) {
    throw new PrintPdfError("sourceImageBytes are required", "MISSING_SOURCE");
  }
  if (!input.qrPngBytes || input.qrPngBytes.byteLength === 0) {
    throw new PrintPdfError("qrPngBytes are required", "MISSING_QR");
  }
  if (typeof input.instructionLine !== "string" || !input.instructionLine.trim()) {
    throw new PrintPdfError("instructionLine is required", "MISSING_INSTRUCTION");
  }
  const rawInstruction = input.instructionLine.trim();
  if (rawInstruction.includes("\n") || rawInstruction.includes("\r")) {
    throw new PrintPdfError("instructionLine must be a single line", "MULTILINE_INSTRUCTION");
  }
  if (rawInstruction.length > INSTRUCTION_MAX) {
    throw new PrintPdfError(
      `instructionLine must be ≤ ${INSTRUCTION_MAX} characters`,
      "INSTRUCTION_TOO_LONG"
    );
  }
  const instruction = toPdfWinAnsiText(rawInstruction);

  const detected = detectSupportedSourceImageMime(input.sourceImageBytes);
  if (!detected) {
    throw new PrintPdfError("source image must be PNG or JPEG", "UNSUPPORTED_SOURCE");
  }
  if (detected !== input.sourceMimeType) {
    throw new PrintPdfError(
      `sourceMimeType ${input.sourceMimeType} does not match bytes (${detected})`,
      "MIME_MISMATCH"
    );
  }

  assertPng(input.qrPngBytes, "qrPngBytes");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let drawing;
  try {
    drawing =
      input.sourceMimeType === "image/png"
        ? await pdf.embedPng(input.sourceImageBytes)
        : await pdf.embedJpg(input.sourceImageBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PrintPdfError(`Failed to embed source image: ${message}`, "CORRUPT_SOURCE");
  }

  let qrImage;
  try {
    qrImage = await pdf.embedPng(input.qrPngBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PrintPdfError(`Failed to embed QR PNG: ${message}`, "CORRUPT_QR");
  }

  const qrX = A4_WIDTH - MARGIN - QR_SIZE;
  const qrY = MARGIN;
  const instructionY = qrY + QR_SIZE + 14;
  const drawingBottom = instructionY + 28;
  const drawingTop = A4_HEIGHT - MARGIN;
  const maxDrawWidth = A4_WIDTH - MARGIN * 2;
  const maxDrawHeight = Math.max(120, drawingTop - drawingBottom);

  const fitted = drawing.scale(
    Math.min(maxDrawWidth / drawing.width, maxDrawHeight / drawing.height)
  );
  const drawX = (A4_WIDTH - fitted.width) / 2;
  const drawY = drawingBottom + (maxDrawHeight - fitted.height) / 2;

  page.drawImage(drawing, {
    x: drawX,
    y: drawY,
    width: fitted.width,
    height: fitted.height
  });

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: QR_SIZE,
    height: QR_SIZE
  });

  const instructionSize = 10;
  const instructionWidth = font.widthOfTextAtSize(instruction, instructionSize);
  const instructionX = Math.max(MARGIN, Math.min(qrX, (A4_WIDTH - instructionWidth) / 2));
  page.drawText(instruction, {
    x: instructionX,
    y: instructionY,
    size: instructionSize,
    font,
    color: rgb(0.15, 0.15, 0.18),
    maxWidth: A4_WIDTH - MARGIN * 2
  });

  if (input.showWatermark) {
    page.drawText(toPdfWinAnsiText(PRINT_WATERMARK_RO), {
      x: A4_WIDTH / 2 - 40,
      y: A4_HEIGHT / 2,
      size: 18,
      font: fontBold,
      color: rgb(0.75, 0.75, 0.78),
      rotate: degrees(35),
      opacity: 0.35
    });
  }

  const bytes = await pdf.save();
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}
