/**
 * Public artifact keys for user-supplied GLB models (Studio import).
 * models/<projectId>/<contentHash>/upload.glb
 */

export const UPLOAD_ARTIFACT_KIND = "upload.glb";

export class UploadModelError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_UPLOAD_MODEL") {
    super(message);
    this.name = "UploadModelError";
    this.code = code;
  }
}

/**
 * Deterministic public artifact key for a promoted studio GLB.
 * models/<projectId>/<contentHash>/upload.glb
 */
export function uploadArtifactKey(projectId: string, contentHash: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "project";
  const safeHash = contentHash.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 64);
  if (!safeHash) {
    throw new UploadModelError("contentHash must be a hex digest for upload artifact keys", "INVALID_CONTENT_HASH");
  }
  return `models/${safeProject}/${safeHash}/${UPLOAD_ARTIFACT_KIND}`;
}
