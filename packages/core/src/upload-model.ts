/**
 * User-uploaded GLB → public R2 key for AR (mode upload).
 */

export const UPLOAD_MODEL_ARTIFACT_KIND = "upload.glb";
export const UPLOAD_MODEL_MAX_BYTES = 25 * 1024 * 1024;

export class UploadModelError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, options: { retryable: boolean; code: string }) {
    super(message);
    this.name = "UploadModelError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

/** models/<projectId>/<inputHash>/upload.glb */
export function uploadModelArtifactKey(projectId: string, inputHash: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "project";
  const safeHash = inputHash.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 64);
  if (!safeHash) {
    throw new UploadModelError("inputHash must be a hex digest for upload model keys", {
      retryable: false,
      code: "INVALID_INPUT_HASH"
    });
  }
  return `models/${safeProject}/${safeHash}/${UPLOAD_MODEL_ARTIFACT_KIND}`;
}

/** glTF binary magic `glTF` (0x46546C67 little-endian at offset 0). */
export function assertGlbMagic(bytes: Uint8Array): void {
  if (bytes.byteLength < 12) {
    throw new UploadModelError("GLB file is too small", {
      retryable: false,
      code: "INVALID_GLB"
    });
  }
  if (bytes.byteLength > UPLOAD_MODEL_MAX_BYTES) {
    throw new UploadModelError("GLB exceeds maximum size", {
      retryable: false,
      code: "GLB_TOO_LARGE"
    });
  }
  const magic =
    bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
  if (!magic) {
    throw new UploadModelError("File is not a binary glTF (GLB)", {
      retryable: false,
      code: "INVALID_GLB"
    });
  }
}
