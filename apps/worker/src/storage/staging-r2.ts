/**
 * Staging R2 write adapter — Put/Head only. No public CDN URLs.
 * getPublicUrl throws; browsers must use short-lived presigned GETs.
 */

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {
  FIGURE_STAGING_BUCKET_NAME,
  FigureStagingError,
  IMMUTABLE_CACHE_CONTROL,
  normalizePublicObjectKey,
  type PublicArtifactMetadata,
  type PublicArtifactStorage,
  type PublicArtifactWriteInput
} from "@kidar/core";
import { defaultR2ApiEndpoint } from "@kidar/core";
import { r2ClientOptions } from "./public";

export function createStagingR2WriteStorage(
  env: NodeJS.ProcessEnv = process.env
): PublicArtifactStorage {
  const accountId = (env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (env.R2_STAGING_BUCKET || env.R2_BUCKET || "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new FigureStagingError("Staging R2 credentials are incomplete", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  if (bucket !== FIGURE_STAGING_BUCKET_NAME) {
    throw new FigureStagingError("R2 bucket must be the dedicated staging figures bucket", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  if ((env.R2_PUBLIC_BASE_URL || "").trim()) {
    throw new FigureStagingError("Staging must not set R2_PUBLIC_BASE_URL", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }

  const endpoint = (env.R2_ENDPOINT || "").trim() || defaultR2ApiEndpoint(accountId);
  const client = new S3Client(
    r2ClientOptions({
      provider: "r2",
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicBaseUrl: "https://staging.invalid",
      endpoint
    })
  );

  return {
    provider: "r2",
    async write(input: PublicArtifactWriteInput) {
      const key = normalizePublicObjectKey(input.key);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl || IMMUTABLE_CACHE_CONTROL,
          Metadata: input.checksum
            ? { checksum: input.checksum, sha256: input.checksum }
            : undefined
        })
      );
      return { key, publicUrl: "" };
    },
    async exists(key: string) {
      const meta = await this.getMetadata(key);
      return Boolean(meta);
    },
    getPublicUrl(_key: string): string {
      throw new FigureStagingError("Staging storage does not expose public CDN URLs", {
        retryable: false,
        code: "STAGING_GUARD"
      });
    },
    async getMetadata(key: string): Promise<PublicArtifactMetadata | null> {
      const normalized = normalizePublicObjectKey(key);
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: normalized })
        );
        return {
          key: normalized,
          size: result.ContentLength,
          contentType: result.ContentType,
          checksum: result.Metadata?.checksum || result.Metadata?.sha256,
          updatedAt: result.LastModified?.toISOString()
        };
      } catch (error) {
        const status =
          error && typeof error === "object" && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
            : undefined;
        if (status === 404) return null;
        const name = error instanceof Error ? error.name : "";
        if (/notfound|nosuchkey/i.test(name)) return null;
        throw error;
      }
    }
  };
}
