import { describe, expect, it } from "vitest";
import { PDFDocument, PageSizes } from "pdf-lib";
import { PNG } from "pngjs";
import {
  DEFAULT_PRINT_INSTRUCTION_RO,
  generateA4PrintPdf,
  PRINT_WATERMARK_RO,
  PrintPdfError
} from "./pdf";
import { generateArQrPng } from "./qr";

function tinyPng(width: number, height: number, rgba: [number, number, number, number]): Uint8Array {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) << 2;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

/** Minimal valid 1×1 JPEG (JFIF). */
function tinyJpeg(): Uint8Array {
  return Uint8Array.from(
    Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
      "base64"
    )
  );
}

describe("generateA4PrintPdf", () => {
  it("produces a valid A4 PDF with PNG source and instruction", async () => {
    const source = tinyPng(64, 48, [30, 144, 255, 255]);
    const qr = await generateArQrPng("https://ar.example.com/ar/demo", { size: 128 });
    const pdfBytes = await generateA4PrintPdf({
      sourceImageBytes: source,
      sourceMimeType: "image/png",
      qrPngBytes: qr,
      instructionLine: DEFAULT_PRINT_INSTRUCTION_RO,
      showWatermark: false
    });

    expect(Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(PageSizes.A4[0], 1);
    expect(height).toBeCloseTo(PageSizes.A4[1], 1);
  });

  it("embeds JPEG sources and includes watermark only for free tier", async () => {
    const qr = await generateArQrPng("https://ar.example.com/ar/demo", { size: 128 });
    const paid = await generateA4PrintPdf({
      sourceImageBytes: tinyJpeg(),
      sourceMimeType: "image/jpeg",
      qrPngBytes: qr,
      instructionLine: DEFAULT_PRINT_INSTRUCTION_RO,
      showWatermark: false
    });
    const free = await generateA4PrintPdf({
      sourceImageBytes: tinyJpeg(),
      sourceMimeType: "image/jpeg",
      qrPngBytes: qr,
      instructionLine: DEFAULT_PRINT_INSTRUCTION_RO,
      showWatermark: true
    });

    const paidDoc = await PDFDocument.load(paid);
    const freeDoc = await PDFDocument.load(free);
    expect(paidDoc.getPageCount()).toBe(1);
    expect(freeDoc.getPageCount()).toBe(1);
    // Watermark adds content-stream operators; free PDF must differ and be larger.
    expect(Buffer.from(free).equals(Buffer.from(paid))).toBe(false);
    expect(free.byteLength).toBeGreaterThan(paid.byteLength);
    // Helvetica WinAnsi often stores printable Latin as literal PDF strings.
    const freeLatin = Buffer.from(free).toString("latin1");
    const paidLatin = Buffer.from(paid).toString("latin1");
    expect(freeLatin.includes("kidAR") || free.byteLength - paid.byteLength > 40).toBe(true);
    expect(paidLatin.includes(PRINT_WATERMARK_RO)).toBe(false);
  });

  it("fails clearly on unsupported or corrupt images and bad instructions", async () => {
    const qr = await generateArQrPng("https://ar.example.com/ar/demo", { size: 128 });
    await expect(
      generateA4PrintPdf({
        sourceImageBytes: new Uint8Array([1, 2, 3]),
        sourceMimeType: "image/png",
        qrPngBytes: qr,
        instructionLine: DEFAULT_PRINT_INSTRUCTION_RO
      })
    ).rejects.toBeInstanceOf(PrintPdfError);

    await expect(
      generateA4PrintPdf({
        sourceImageBytes: tinyPng(8, 8, [0, 0, 0, 255]),
        sourceMimeType: "image/jpeg",
        qrPngBytes: qr,
        instructionLine: DEFAULT_PRINT_INSTRUCTION_RO
      })
    ).rejects.toThrow(/does not match/i);

    await expect(
      generateA4PrintPdf({
        sourceImageBytes: tinyPng(8, 8, [0, 0, 0, 255]),
        sourceMimeType: "image/png",
        qrPngBytes: new Uint8Array([0xff, 0xd8, 0xff]),
        instructionLine: DEFAULT_PRINT_INSTRUCTION_RO
      })
    ).rejects.toThrow(/PNG/i);

    await expect(
      generateA4PrintPdf({
        sourceImageBytes: tinyPng(8, 8, [0, 0, 0, 255]),
        sourceMimeType: "image/png",
        qrPngBytes: qr,
        instructionLine: "line1\nline2"
      })
    ).rejects.toThrow(/single line/i);
  });
});
