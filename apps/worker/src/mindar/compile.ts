import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MindCompileError, assertSupportedSourceImage } from "@kidar/core";

export type CompileTargetsMindFn = (imageBytes: Uint8Array) => Promise<Uint8Array>;

type OfflineCompilerCtor = new () => {
  compileImageTargets(
    images: unknown[],
    progressCallback: (percent: number) => void
  ): Promise<unknown>;
  exportData(): Uint8Array;
};

/**
 * Compile a JPEG/PNG source into a MindAR targets.mind buffer using the
 * official OfflineCompiler + node-canvas loadImage path (mind-ar@1.2.5).
 *
 * Temp files are cleaned even when compile fails.
 * Canvas/mind-ar are loaded dynamically so unit tests can mock `compile`
 * without requiring native canvas on Windows.
 */
export async function compileTargetsMind(imageBytes: Uint8Array): Promise<Uint8Array> {
  const mime = assertSupportedSourceImage(imageBytes);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "kidar-mind-compile-"));
  try {
    const ext = mime === "image/png" ? "png" : "jpg";
    const imagePath = path.join(tempRoot, `source.${ext}`);
    await writeFile(imagePath, imageBytes);

    let OfflineCompiler: OfflineCompilerCtor;
    let loadImage: (src: string) => Promise<{ width: number; height: number }>;
    try {
      const mindMod = await import("mind-ar/src/image-target/offline-compiler.js");
      const canvasMod = await import("canvas");
      OfflineCompiler = mindMod.OfflineCompiler as OfflineCompilerCtor;
      loadImage = canvasMod.loadImage as typeof loadImage;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new MindCompileError(
        `MindAR OfflineCompiler dependencies unavailable (install canvas native deps on Linux): ${message}`,
        { retryable: false, code: "MISSING_COMPILER" }
      );
    }

    let image: { width: number; height: number };
    try {
      image = await loadImage(imagePath);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new MindCompileError(`Failed to decode source image: ${message}`, {
        retryable: false,
        code: "INVALID_SOURCE"
      });
    }

    if (!image.width || !image.height) {
      throw new MindCompileError("Source image has invalid dimensions", {
        retryable: false,
        code: "INVALID_SOURCE"
      });
    }

    try {
      const compiler = new OfflineCompiler();
      await compiler.compileImageTargets([image], () => undefined);
      const exported = compiler.exportData();
      const bytes =
        exported instanceof Uint8Array
          ? exported
          : new Uint8Array(exported as ArrayBuffer);
      if (bytes.byteLength === 0) {
        throw new MindCompileError("OfflineCompiler exported an empty buffer", {
          retryable: false,
          code: "INVALID_MIND"
        });
      }
      return bytes;
    } catch (cause) {
      if (cause instanceof MindCompileError) throw cause;
      const message = cause instanceof Error ? cause.message : String(cause);
      const missingDep =
        /Cannot find module|MODULE_NOT_FOUND|canvas|tensorflow|mind-ar/i.test(message);
      throw new MindCompileError(`MindAR OfflineCompiler failed: ${message}`, {
        retryable: !missingDep,
        code: missingDep ? "MISSING_COMPILER" : "COMPILER_FAILED"
      });
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

/** Pure description of the compile invocation (for unit tests without running TF). */
export function describeMindCompileInvocation(input: {
  projectId: string;
  inputHash: string;
  sourceBytes: number;
  mime: string;
}) {
  return {
    engine: "offline-compiler-cpu",
    package: "mind-ar",
    packageVersion: "1.2.5",
    entry: "mind-ar/src/image-target/offline-compiler.js",
    loader: "canvas.loadImage",
    targetCount: 1,
    projectId: input.projectId,
    inputHash: input.inputHash,
    sourceBytes: input.sourceBytes,
    mime: input.mime
  };
}
