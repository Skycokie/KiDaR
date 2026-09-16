/**
 * Public consumer artifact storage boundary (M4.1).
 *
 * Studio source drawings stay in the private Appwrite bucket (`source-drawings`).
 * Public AR outputs must use R2 (preferred) or a *separate* public Appwrite bucket.
 * This module validates configuration and exposes interfaces; upload adapters may
 * be stubs that fail until M4.2+ wires real providers.
 */

export type PublicStorageProviderId = "r2" | "appwrite";

export interface PublicArtifactWriteInput {
  /** Stable object key, ideally content-addressed / versioned. */
  key: string;
  body: Uint8Array;
  contentType: string;
  /** Optional content checksum for metadata. */
  checksum?: string;
  cacheControl?: string;
}

export interface PublicArtifactMetadata {
  key: string;
  size?: number;
  contentType?: string;
  checksum?: string;
  updatedAt?: string;
}

export interface PublicArtifactStorage {
  readonly provider: PublicStorageProviderId;
  write(input: PublicArtifactWriteInput): Promise<{ key: string; publicUrl: string }>;
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
  getMetadata(key: string): Promise<PublicArtifactMetadata | null>;
}

export class PublicStorageConfigError extends Error {
  readonly code = "PUBLIC_STORAGE_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "PublicStorageConfigError";
  }
}

export interface R2PublicStorageConfig {
  provider: "r2";
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  /** Optional S3 API endpoint override; default Cloudflare R2 endpoint. */
  endpoint?: string;
}

export interface AppwritePublicStorageConfig {
  provider: "appwrite";
  endpoint: string;
  projectId: string;
  apiKey: string;
  /** Must differ from the private source bucket. */
  bucketId: string;
}

export type PublicStorageConfig = R2PublicStorageConfig | AppwritePublicStorageConfig;

export interface PublicStorageEnv {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
  R2_ENDPOINT?: string;
  NEXT_PUBLIC_APPWRITE_ENDPOINT?: string;
  APPWRITE_ENDPOINT?: string;
  NEXT_PUBLIC_APPWRITE_PROJECT_ID?: string;
  APPWRITE_PROJECT_ID?: string;
  APPWRITE_API_KEY?: string;
  APPWRITE_SOURCE_BUCKET?: string;
  APPWRITE_ASSETS_BUCKET?: string;
  /** Prefer `r2` | `appwrite`. Empty → auto (R2 if complete, else Appwrite if valid). */
  PUBLIC_ARTIFACT_STORAGE?: string;
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function r2Complete(env: PublicStorageEnv): boolean {
  return (
    present(env.R2_ACCOUNT_ID) &&
    present(env.R2_ACCESS_KEY_ID) &&
    present(env.R2_SECRET_ACCESS_KEY) &&
    present(env.R2_BUCKET) &&
    present(env.R2_PUBLIC_BASE_URL)
  );
}

function resolveAppwriteFallback(env: PublicStorageEnv): AppwritePublicStorageConfig {
  const source = (env.APPWRITE_SOURCE_BUCKET || "source-drawings").trim();
  const assets = (env.APPWRITE_ASSETS_BUCKET || "").trim();
  if (!assets) {
    throw new PublicStorageConfigError(
      "Appwrite public artifact fallback requires APPWRITE_ASSETS_BUCKET to be set to a separate public bucket (not the private source bucket)."
    );
  }
  if (assets === source) {
    throw new PublicStorageConfigError(
      `Appwrite public artifact fallback rejected: APPWRITE_ASSETS_BUCKET ("${assets}") must differ from APPWRITE_SOURCE_BUCKET ("${source}"). Never publish from the private source-drawings bucket.`
    );
  }
  const endpoint = env.NEXT_PUBLIC_APPWRITE_ENDPOINT || env.APPWRITE_ENDPOINT;
  const projectId = env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || env.APPWRITE_PROJECT_ID;
  const apiKey = env.APPWRITE_API_KEY;
  if (!present(endpoint) || !present(projectId) || !present(apiKey)) {
    throw new PublicStorageConfigError(
      "Appwrite public artifact fallback requires NEXT_PUBLIC_APPWRITE_ENDPOINT (or APPWRITE_ENDPOINT), NEXT_PUBLIC_APPWRITE_PROJECT_ID (or APPWRITE_PROJECT_ID), and APPWRITE_API_KEY."
    );
  }
  return {
    provider: "appwrite",
    endpoint: endpoint.trim(),
    projectId: projectId.trim(),
    apiKey: apiKey.trim(),
    bucketId: assets
  };
}

function resolveR2(env: PublicStorageEnv): R2PublicStorageConfig {
  if (!r2Complete(env)) {
    throw new PublicStorageConfigError(
      "R2 public artifact storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL."
    );
  }
  return {
    provider: "r2",
    accountId: env.R2_ACCOUNT_ID!.trim(),
    accessKeyId: env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
    bucket: env.R2_BUCKET!.trim(),
    publicBaseUrl: env.R2_PUBLIC_BASE_URL!.trim().replace(/\/$/, ""),
    endpoint: present(env.R2_ENDPOINT) ? env.R2_ENDPOINT.trim() : undefined
  };
}

/**
 * Resolve public artifact storage configuration.
 * Preference: explicit PUBLIC_ARTIFACT_STORAGE, else R2 if complete, else Appwrite fallback if valid.
 * Throws PublicStorageConfigError when no safe provider is configured.
 */
export function resolvePublicStorageConfig(
  env: PublicStorageEnv | Record<string, string | undefined> = {}
): PublicStorageConfig {
  const view = env as PublicStorageEnv;
  const preference = (view.PUBLIC_ARTIFACT_STORAGE || "").trim().toLowerCase();

  if (preference === "r2") return resolveR2(view);
  if (preference === "appwrite") return resolveAppwriteFallback(view);

  if (preference && preference !== "auto") {
    throw new PublicStorageConfigError(
      `Unknown PUBLIC_ARTIFACT_STORAGE "${preference}". Use "r2", "appwrite", or leave unset for auto.`
    );
  }

  if (r2Complete(view)) return resolveR2(view);

  const source = (view.APPWRITE_SOURCE_BUCKET || "source-drawings").trim();
  const assets = (view.APPWRITE_ASSETS_BUCKET || "").trim();
  if (assets && assets !== source) {
    return resolveAppwriteFallback(view);
  }

  throw new PublicStorageConfigError(
    "No public artifact storage configured. Set complete R2_* variables (preferred), or configure a separate APPWRITE_ASSETS_BUCKET different from APPWRITE_SOURCE_BUCKET only when a public Appwrite bucket is available on the plan. Publishing must not use the private source-drawings bucket."
  );
}

/** Adapter that always fails — used until a real R2/Appwrite public writer is wired. */
export function createUnimplementedPublicStorage(config: PublicStorageConfig): PublicArtifactStorage {
  const message = `Public artifact storage provider "${config.provider}" is configured but not implemented in M4.1. Configure validation passed; upload arrives in a later milestone.`;
  return {
    provider: config.provider,
    async write() {
      throw new PublicStorageConfigError(message);
    },
    async exists() {
      throw new PublicStorageConfigError(message);
    },
    getPublicUrl(key: string) {
      if (config.provider === "r2") {
        return `${config.publicBaseUrl}/${key.replace(/^\//, "")}`;
      }
      throw new PublicStorageConfigError(message);
    },
    async getMetadata() {
      throw new PublicStorageConfigError(message);
    }
  };
}

/**
 * Validate env and return a storage handle.
 * M4.1 returns an unimplemented adapter after successful config validation.
 */
export function createPublicArtifactStorage(
  env: PublicStorageEnv | Record<string, string | undefined> = {}
): PublicArtifactStorage {
  return createUnimplementedPublicStorage(resolvePublicStorageConfig(env));
}
