/**
 * Server-only R2 GetObject presigning for staging figure assets.
 * Never import from client components.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  FIGURE_STAGING_BUCKET_NAME,
  FIGURE_STAGING_ENVIRONMENT,
  FIGURE_STAGING_GLB_PRESIGN_TTL_SEC,
  FIGURE_STAGING_USDZ_PRESIGN_TTL_SEC,
  FigureStagingError,
  assertFigureStagingEnvironment,
  assertFigureStagingObjectKey,
  defaultR2ApiEndpoint
} from "@kidar/core";

export type StagingR2PresignConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

export function resolveStagingR2PresignConfig(
  env: Record<string, string | undefined> = process.env
): StagingR2PresignConfig {
  assertFigureStagingEnvironment({
    jobEnvironment: env.KIDAR_RUNTIME_ENV || "",
    r2Bucket: env.R2_BUCKET || env.R2_STAGING_BUCKET,
    stagingBucket: env.R2_STAGING_BUCKET || env.R2_BUCKET,
    appwriteProjectId: env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || env.APPWRITE_PROJECT_ID,
    productionAppwriteProjectId: env.KIDAR_PRODUCTION_APPWRITE_PROJECT_ID,
    expectedBucketName: FIGURE_STAGING_BUCKET_NAME
  });

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

  // Explicitly reject production public CDN wiring in staging.
  if ((env.R2_PUBLIC_BASE_URL || "").trim()) {
    throw new FigureStagingError("Staging must not set R2_PUBLIC_BASE_URL", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }

  const endpoint = (env.R2_ENDPOINT || "").trim() || defaultR2ApiEndpoint(accountId);
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

function createStagingS3Client(config: StagingR2PresignConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });
}

export type PresignFigureAssetsInput = {
  projectId: string;
  glbKey: string;
  usdzKey: string;
  now?: Date;
  /** Injected for tests — returns opaque https URLs without real signing. */
  signGetObject?: (input: {
    bucket: string;
    key: string;
    expiresIn: number;
  }) => Promise<string>;
  config?: StagingR2PresignConfig;
  env?: Record<string, string | undefined>;
};

export type PresignedFigureUrls = {
  glbUrl: string;
  usdzUrl: string;
  expiresAt: string;
};

/**
 * Derive and sign only the two staging keys for a project. Never accepts client keys.
 */
export async function presignFigureAssetGets(
  input: PresignFigureAssetsInput
): Promise<PresignedFigureUrls> {
  const glbKey = assertFigureStagingObjectKey(input.projectId, input.glbKey, "glb");
  const usdzKey = assertFigureStagingObjectKey(input.projectId, input.usdzKey, "usdz");
  const config = input.config ?? resolveStagingR2PresignConfig(input.env ?? process.env);
  const now = input.now ?? new Date();

  const sign =
    input.signGetObject ??
    (async ({ bucket, key, expiresIn }) => {
      const client = createStagingS3Client(config);
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn });
    });

  const glbUrl = await sign({
    bucket: config.bucket,
    key: glbKey,
    expiresIn: FIGURE_STAGING_GLB_PRESIGN_TTL_SEC
  });
  const usdzUrl = await sign({
    bucket: config.bucket,
    key: usdzKey,
    expiresIn: FIGURE_STAGING_USDZ_PRESIGN_TTL_SEC
  });

  // expiresAt uses the shorter GLB TTL so the client refreshes before either expires.
  const expiresAt = new Date(now.getTime() + FIGURE_STAGING_GLB_PRESIGN_TTL_SEC * 1000).toISOString();

  assertPresignedUrlSafe(glbUrl);
  assertPresignedUrlSafe(usdzUrl);

  return { glbUrl, usdzUrl, expiresAt };
}

function assertPresignedUrlSafe(url: string): void {
  if (!/^https:\/\//i.test(url)) {
    throw new FigureStagingError("Presigned URL must be https", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  // Never allow accidentally returning raw credentials in the URL path.
  if (/R2_ACCESS_KEY|SECRET_ACCESS|AWS_SECRET/i.test(url)) {
    throw new FigureStagingError("Presigned URL looks unsafe", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
}

export function assertStagingRuntimeForFigures(
  env: Record<string, string | undefined> = process.env
): void {
  if ((env.KIDAR_RUNTIME_ENV || "").trim().toLowerCase() !== FIGURE_STAGING_ENVIRONMENT) {
    throw new FigureStagingError("Figure API requires staging runtime", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
}
