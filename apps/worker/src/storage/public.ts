import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {
  PublicStorageConfigError,
  R2PublicArtifactStorage,
  isAllowedUnpublishKey,
  normalizePublicObjectKey,
  publicArtifactUrl,
  resolvePublicStorageConfig,
  type PublicArtifactMetadata,
  type PublicArtifactStorage,
  type PublicArtifactWriteInput,
  type R2ObjectStore,
  type R2PublicStorageConfig
} from "@kidar/core";

export class MemoryPublicArtifactStorage implements PublicArtifactStorage {
  readonly provider = "r2" as const;
  private readonly objects = new Map<
    string,
    { body: Uint8Array; contentType: string; checksum?: string }
  >();

  constructor(private readonly publicBaseUrl = "https://memory.local") {}

  async write(input: PublicArtifactWriteInput) {
    const key = normalizePublicObjectKey(input.key);
    this.objects.set(key, {
      body: input.body,
      contentType: input.contentType,
      checksum: input.checksum
    });
    return { key, publicUrl: this.getPublicUrl(key) };
  }

  async exists(key: string) {
    return this.objects.has(normalizePublicObjectKey(key));
  }

  getPublicUrl(key: string) {
    return publicArtifactUrl(this.publicBaseUrl, key, { allowLocalOrigins: true });
  }

  async getMetadata(key: string): Promise<PublicArtifactMetadata | null> {
    const normalized = normalizePublicObjectKey(key);
    const hit = this.objects.get(normalized);
    if (!hit) return null;
    return {
      key: normalized,
      size: hit.body.byteLength,
      contentType: hit.contentType,
      checksum: hit.checksum
    };
  }
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const status = candidate.$metadata?.httpStatusCode;
  const name = `${candidate.name || ""} ${candidate.Code || ""}`;
  return (
    status === 404 ||
    /notfound|nosuchkey|nosuchbucket/i.test(name)
  );
}

export class S3R2ObjectStore implements R2ObjectStore {
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

export function r2ClientOptions(config: R2PublicStorageConfig) {
  return {
    region: "auto" as const,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    // AWS SDK 3.729+ signs default CRC32 checksums; R2 returns AccessDenied.
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const
  };
}

function r2Client(config: R2PublicStorageConfig) {
  return new S3Client(r2ClientOptions(config));
}

/**
 * Create the configured public storage provider.
 * Appwrite fallback remains unsupported for writes (R2 only).
 */
export function createWorkerPublicStorage(
  env: NodeJS.ProcessEnv = process.env
): PublicArtifactStorage {
  const config = resolvePublicStorageConfig(env);
  if (config.provider !== "r2") {
    throw new PublicStorageConfigError(
      "Worker requires R2 public artifact storage. Appwrite public fallback is not wired for uploads, and source-drawings must stay private."
    );
  }
  return new R2PublicArtifactStorage(config, new S3R2ObjectStore(r2Client(config), config.bucket));
}

/** Delete only `__kidar_verify__/` objects from the verify probe. Not a runtime API. */
export async function deleteR2VerifyObject(input: {
  config: R2PublicStorageConfig;
  key: string;
}): Promise<void> {
  const key = normalizePublicObjectKey(input.key);
  if (!key.startsWith("__kidar_verify__/")) {
    throw new PublicStorageConfigError("Refusing to delete a key outside __kidar_verify__/");
  }
  const client = r2Client(input.config);
  await client.send(new DeleteObjectCommand({ Bucket: input.config.bucket, Key: key }));
}

/**
 * Delete allow-listed public keys (experience pointer + page artifacts).
 * Missing keys are treated as success (idempotent unpublish).
 */
export async function deletePublicArtifactKeys(
  keys: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<{ deleted: string[]; skipped: string[] }> {
  const config = resolvePublicStorageConfig(env);
  if (config.provider !== "r2") {
    throw new PublicStorageConfigError("Unpublish requires R2 public artifact storage.");
  }
  const client = r2Client(config);
  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const raw of keys) {
    const key = normalizePublicObjectKey(raw);
    if (!isAllowedUnpublishKey(key)) {
      throw new PublicStorageConfigError(`Refusing to delete key outside unpublish allow-list: ${key}`);
    }
    try {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      deleted.push(key);
    } catch (error) {
      if (isNotFound(error)) {
        skipped.push(key);
        continue;
      }
      throw error;
    }
  }
  return { deleted, skipped };
}
