import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput
} from "@aws-sdk/client-s3";
import {
  PublicStorageConfigError,
  resolvePublicStorageConfig,
  type PublicArtifactMetadata,
  type PublicArtifactStorage,
  type PublicArtifactWriteInput,
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
    this.objects.set(input.key, {
      body: input.body,
      contentType: input.contentType,
      checksum: input.checksum
    });
    return { key: input.key, publicUrl: this.getPublicUrl(input.key) };
  }

  async exists(key: string) {
    return this.objects.has(key);
  }

  getPublicUrl(key: string) {
    return `${this.publicBaseUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
  }

  async getMetadata(key: string): Promise<PublicArtifactMetadata | null> {
    const hit = this.objects.get(key);
    if (!hit) return null;
    return {
      key,
      size: hit.body.byteLength,
      contentType: hit.contentType,
      checksum: hit.checksum
    };
  }
}

function r2Client(config: R2PublicStorageConfig) {
  const endpoint =
    config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export class R2PublicArtifactStorage implements PublicArtifactStorage {
  readonly provider = "r2" as const;
  private readonly client: S3Client;

  constructor(private readonly config: R2PublicStorageConfig) {
    this.client = r2Client(config);
  }

  getPublicUrl(key: string) {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
  }

  async exists(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<PublicArtifactMetadata | null> {
    try {
      const head: HeadObjectCommandOutput = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
      return {
        key,
        size: head.ContentLength,
        contentType: head.ContentType,
        checksum: head.Metadata?.checksum || head.Metadata?.sha256,
        updatedAt: head.LastModified?.toISOString()
      };
    } catch {
      return null;
    }
  }

  async write(input: PublicArtifactWriteInput) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
        Metadata: input.checksum ? { checksum: input.checksum, sha256: input.checksum } : undefined
      })
    );
    return { key: input.key, publicUrl: this.getPublicUrl(input.key) };
  }
}

/**
 * Create the configured public storage provider.
 * Appwrite fallback remains unsupported for writes in M4.2 (R2 only).
 */
export function createWorkerPublicStorage(
  env: NodeJS.ProcessEnv = process.env
): PublicArtifactStorage {
  const config = resolvePublicStorageConfig(env);
  if (config.provider !== "r2") {
    throw new PublicStorageConfigError(
      "M4.2 worker requires R2 public artifact storage. Appwrite public fallback is not wired for uploads yet, and source-drawings must stay private."
    );
  }
  return new R2PublicArtifactStorage(config);
}
