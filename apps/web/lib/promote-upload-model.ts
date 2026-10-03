import { createHash } from "node:crypto";
import {
  createPublicArtifactStorage,
  assertGlbMagic,
  uploadModelArtifactKey,
  UploadModelError,
  PublicStorageConfigError,
  IMMUTABLE_CACHE_CONTROL,
  PUBLIC_ARTIFACT_CONTENT_TYPES
} from "@kidar/core";

/**
 * Copy a private Appwrite GLB onto public R2 and return the HTTPS URL.
 * Used by asset upload and publish (mode upload).
 */
export async function promoteUploadModelToPublic(input: {
  projectId: string;
  bytes: Uint8Array;
  env?: NodeJS.ProcessEnv;
}): Promise<{ key: string; publicUrl: string }> {
  assertGlbMagic(input.bytes);
  const contentChecksum = createHash("sha256").update(input.bytes).digest("hex");
  const key = uploadModelArtifactKey(input.projectId, contentChecksum);
  try {
    const storage = createPublicArtifactStorage(input.env ?? process.env);
    const existing = await storage.getMetadata(key);
    if (existing?.checksum === contentChecksum) {
      return { key, publicUrl: storage.getPublicUrl(key) };
    }
    const written = await storage.write({
      key,
      body: input.bytes,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.glb,
      checksum: contentChecksum,
      cacheControl: IMMUTABLE_CACHE_CONTROL
    });
    return { key: written.key, publicUrl: written.publicUrl };
  } catch (cause) {
    if (cause instanceof UploadModelError || cause instanceof PublicStorageConfigError) {
      throw cause;
    }
    throw new UploadModelError(
      cause instanceof Error ? cause.message : "Failed to publish upload model",
      { retryable: true, code: "PROMOTE_FAILED" }
    );
  }
}
