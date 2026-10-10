import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSourceFile } from "./normalize-source-file";

function makeFile(name: string, type: string, size = 1200): File {
  const buffer = new Uint8Array(Math.min(size, 64));
  const blob = new Blob([buffer], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("normalizeSourceFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("passes jpeg through unchanged", async () => {
    const file = makeFile("a.jpg", "image/jpeg");
    const result = await normalizeSourceFile(file);
    expect(result).toEqual({ ok: true, file, converted: false });
  });

  it("rejects oversized files", async () => {
    const file = makeFile("big.jpg", "image/jpeg", 11 * 1024 * 1024);
    await expect(normalizeSourceFile(file)).resolves.toEqual({ ok: false, code: "size" });
  });

  it("converts heic via createImageBitmap when available", async () => {
    const bitmap = {
      width: 32,
      height: 24,
      close: vi.fn()
    };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));
    });
    const getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn()
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext,
            toBlob
          };
        }
        throw new Error(`unexpected element ${tag}`);
      }
    });

    const result = await normalizeSourceFile(makeFile("phone.heic", "image/heic"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.converted).toBe(true);
      expect(result.file.type).toBe("image/jpeg");
      expect(result.file.name).toBe("phone.jpg");
    }
    expect(bitmap.close).toHaveBeenCalled();
  });
});
