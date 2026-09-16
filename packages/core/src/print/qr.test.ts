import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { generateArQrPng, QrGenerateError } from "./qr";

function readPng(bytes: Uint8Array): PNG {
  return PNG.sync.read(Buffer.from(bytes));
}

describe("generateArQrPng", () => {
  it("returns a non-empty PNG with expected dimensions", async () => {
    const url = "https://ar.example.com/ar/demo-project";
    const png = await generateArQrPng(url, { size: 256 });
    expect(png.byteLength).toBeGreaterThan(100);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);

    const decoded = readPng(png);
    expect(decoded.width).toBe(256);
    expect(decoded.height).toBe(256);
  });

  it("encodes the absolute URL deterministically for the same input", async () => {
    const url = "https://ar.example.com/ar/kid-drawing";
    const a = await generateArQrPng(url, { size: 192, margin: 2 });
    const b = await generateArQrPng(url, { size: 192, margin: 2 });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);

    const png = readPng(a);
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(code).not.toBeNull();
    expect(code?.data).toBe(url);
  });

  it("rejects malformed URLs, credentials, and non-https (unless local test)", async () => {
    await expect(generateArQrPng("not-absolute")).rejects.toBeInstanceOf(QrGenerateError);
    await expect(generateArQrPng("https://user:secret@ar.example.com/x")).rejects.toThrow(
      /credentials/i
    );
    await expect(generateArQrPng("http://ar.example.com/x")).rejects.toThrow(/https/i);
    await expect(
      generateArQrPng("https://ar.example.com/x?X-Amz-Signature=abc")
    ).rejects.toThrow(/private or signed/i);

    const local = await generateArQrPng("http://localhost:3000/ar/demo", {
      allowLocalOrigins: true,
      size: 128
    });
    expect(local[0]).toBe(0x89);
  });
});
