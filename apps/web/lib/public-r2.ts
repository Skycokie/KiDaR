/**
 * Server-only R2 Put for public consumer GLBs (Studio model promote).
 * Never import from client components.
 */

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  IMMUTABLE_CACHE_CONTROL,
  PUBLIC_ARTIFACT_CONTENT_TYPES,
  PublicStorageConfigError,
  R2PublicArtifactStorage,
  normalizePublicObjectKey,
  publicArtifactUrl,
  resolvePublicStorageConfig,
  type PublicArtifactMetadata,
  type PublicArtifactStorage,
  type PublicArtifactWriteInput,
  type R2ObjectStore,
  type R2PublicStorageConfig
} from "@kidar/core";

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const status = candidate.$metadata?.httpStatusCode;
  const name = `${candidate.name || ""} ${candidate.Code || ""}`;
  return status === 404 || /notfound|nosuchkey|nosuchbucket/i.test(name);
}

function r2ClientOptions(config: R2PublicStorageConfig) {
  return {
    region: "auto" as const,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const
  };
}

class S3R2ObjectStore implements R2ObjectStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    cacheControl: string;
    checksum?: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
        Metadata: input.checksum
          ? { checksum: input.checksum, sha256: input.checksum }
          : undefined
      })
    );
  }

  async head(key: string) {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        cacheControl: result.CacheControl,
        checksum: result.Metadata?.checksum || result.Metadata?.sha256,
        updatedAt: result.LastModified?.toISOString()
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }
}

/**
 * Writable R2 public storage for the web app (model promote on Studio import).
 * Throws when R2 is incomplete or the provider is Appwrite-only.
 */
type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function createWebPublicStorage(env: EnvLike = process.env): PublicArtifactStorage {
  const config = resolvePublicStorageConfig(env);
  if (config.provider !== "r2") {
    throw new PublicStorageConfigError(
      "Studio model promote requires R2 public artifact storage."
    );
  }
  const client = new S3Client(r2ClientOptions(config));
  return new R2PublicArtifactStorage(config, new S3R2ObjectStore(client, config.bucket));
}

/** True when complete R2_* env is present (publish-ready CDN). */
export function isWebPublicR2Ready(env: EnvLike = process.env): boolean {
  try {
    const config = resolvePublicStorageConfig(env);
    return config.provider === "r2";
  } catch {
    return false;
  }
}

export async function promoteGlbToPublicR2(input: {
  key: string;
  body: Uint8Array;
  checksum?: string;
  env?: EnvLike;
}): Promise<{ key: string; publicUrl: string }> {
  const storage = createWebPublicStorage(input.env);
  const writeInput: PublicArtifactWriteInput = {
    key: normalizePublicObjectKey(input.key),
    body: input.body,
    contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.glb,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    checksum: input.checksum
  };
  return storage.write(writeInput);
}

export function publicUrlForKey(key: string, env: EnvLike = process.env): string {
  const config = resolvePublicStorageConfig(env);
  if (config.provider !== "r2") {
    throw new PublicStorageConfigError("publicUrlForKey requires R2.");
  }
  return publicArtifactUrl(config.publicBaseUrl, key);
}

export type { PublicArtifactMetadata };
