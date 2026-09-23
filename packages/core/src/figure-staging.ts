/**
 * Staging-only figure assets for internal AR Quick Look tests.
 * Metadata stores object keys only — browsers receive short-lived R2 presigned URLs
 * from a server endpoint. Never use R2_PUBLIC_BASE_URL for staging delivery.
 */

export type FigureAssetStatus = "pending" | "processing" | "ready" | "failed";

export type FigureAssets = {
  projectId: string;
  status: FigureAssetStatus;
  /** Idempotent job / asset id used in object keys. */
  jobId?: string;
  /** R2 object key under staging/projects/.../model.glb — never a browser URL. */
  glbKey?: string;
  /** R2 object key under staging/projects/.../model.usdz — never a browser URL. */
  usdzKey?: string;
  posterKey?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type FigureGenerationJob = {
  jobId: string;
  environment: "staging";
  projectId: string;
  sourceImageUrl: string;
  requestedFormats: ["glb", "usdz"];
  requestedBy: "internal";
};

export const FIGURE_STAGING_ENVIRONMENT = "staging" as const;

/** Exact bucket name required for staging figure writes and reads. */
export const FIGURE_STAGING_BUCKET_NAME = "kidar-figures-staging";

export const FIGURE_STAGING_KEY_PREFIX = "staging/projects";

export const FIGURE_STAGING_GLB_KIND = "model.glb";
export const FIGURE_STAGING_USDZ_KIND = "model.usdz";

/** Reject USDZ downloads above this size before staging write (80 MiB). */
export const FIGURE_STAGING_MAX_USDZ_BYTES = 80 * 1024 * 1024;

/** Apple Quick Look expects model/vnd.usdz+zip. */
export const FIGURE_STAGING_USDZ_CONTENT_TYPE = "model/vnd.usdz+zip";

/** Presigned GET TTL for model-viewer GLB (seconds). */
export const FIGURE_STAGING_GLB_PRESIGN_TTL_SEC = 10 * 60;

/** Presigned GET TTL for Quick Look USDZ (seconds). */
export const FIGURE_STAGING_USDZ_PRESIGN_TTL_SEC = 25 * 60;

/** Presigned GET TTL for worker source downloads (seconds). */
export const FIGURE_STAGING_SOURCE_PRESIGN_TTL_SEC = 5 * 60;

export type FigureStagingErrorCode =
  | "STAGING_GUARD"
  | "TRIPO_REJECTED"
  | "TRIPO_TRANSIENT"
  | "TRIPO_CONFIG_MISSING"
  | "GLB_INVALID"
  | "USDZ_INVALID"
  | "UPLOAD_FAILED"
  | "SOURCE_INVALID";

export class FigureStagingError extends Error {
  readonly retryable: boolean;
  readonly code: FigureStagingErrorCode;

  constructor(message: string, options: { retryable: boolean; code: FigureStagingErrorCode }) {
    super(message);
    this.name = "FigureStagingError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

function safeSegment(raw: string, max = 64): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, max);
}

/**
 * Deterministic staging object keys (idempotent on jobId).
 * staging/projects/{projectId}/figures/{jobId}/model.glb|usdz
 */
export function figureStagingGlbKey(projectId: string, jobId: string): string {
  const safeProject = safeSegment(projectId) || "project";
  const safeJob = safeSegment(jobId) || "job";
  return `${FIGURE_STAGING_KEY_PREFIX}/${safeProject}/figures/${safeJob}/${FIGURE_STAGING_GLB_KIND}`;
}

export function figureStagingUsdzKey(projectId: string, jobId: string): string {
  const safeProject = safeSegment(projectId) || "project";
  const safeJob = safeSegment(jobId) || "job";
  return `${FIGURE_STAGING_KEY_PREFIX}/${safeProject}/figures/${safeJob}/${FIGURE_STAGING_USDZ_KIND}`;
}

/**
 * Validate a staging object key for a known projectId.
 * Rejects traversal, foreign prefixes, wrong suffixes, and mismatched project segments.
 */
export function assertFigureStagingObjectKey(
  projectId: string,
  key: string,
  kind: "glb" | "usdz"
): string {
  if (typeof key !== "string" || !key.trim()) {
    throw new FigureStagingError("Object key is required", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  const trimmed = key.trim();
  if (
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("://") ||
    trimmed.startsWith("/") ||
    trimmed.includes("%2f") ||
    trimmed.includes("%2F") ||
    trimmed.includes("..")
  ) {
    throw new FigureStagingError("Object key is invalid", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }

  const expectedSuffix = kind === "glb" ? FIGURE_STAGING_GLB_KIND : FIGURE_STAGING_USDZ_KIND;
  const expected =
    kind === "glb"
      ? figureStagingGlbKey(projectId, extractJobIdFromStagingKey(trimmed, projectId) || "x")
      : figureStagingUsdzKey(projectId, extractJobIdFromStagingKey(trimmed, projectId) || "x");

  // Rebuild expected from segments so we do not trust a forged jobId in a foreign prefix.
  const safeProject = safeSegment(projectId) || "project";
  const prefix = `${FIGURE_STAGING_KEY_PREFIX}/${safeProject}/figures/`;
  if (!trimmed.startsWith(prefix)) {
    throw new FigureStagingError("Object key must stay under the project staging prefix", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  const rest = trimmed.slice(prefix.length);
  const parts = rest.split("/");
  if (parts.length !== 2 || !parts[0] || parts[1] !== expectedSuffix) {
    throw new FigureStagingError("Object key must be figures/{jobId}/model.(glb|usdz)", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  if (safeSegment(parts[0]) !== parts[0]) {
    throw new FigureStagingError("Object key job segment is invalid", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  // Silence unused expected when paths match via prefix checks above.
  void expected;
  return trimmed;
}

function extractJobIdFromStagingKey(key: string, projectId: string): string | null {
  const safeProject = safeSegment(projectId) || "project";
  const prefix = `${FIGURE_STAGING_KEY_PREFIX}/${safeProject}/figures/`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const jobId = rest.split("/")[0];
  return jobId || null;
}

/** USDZ is a ZIP package — PK magic. */
export function isUsdzBuffer(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function assertUsdzArtifact(bytes: Uint8Array): void {
  if (!bytes.byteLength) {
    throw new FigureStagingError("USDZ artifact is empty", {
      retryable: false,
      code: "USDZ_INVALID"
    });
  }
  if (bytes.byteLength > FIGURE_STAGING_MAX_USDZ_BYTES) {
    throw new FigureStagingError("USDZ artifact exceeds size limit", {
      retryable: false,
      code: "USDZ_INVALID"
    });
  }
  if (!isUsdzBuffer(bytes)) {
    throw new FigureStagingError("USDZ artifact missing ZIP magic", {
      retryable: false,
      code: "USDZ_INVALID"
    });
  }
}

/**
 * Strip object keys and any accidental URLs before sending metadata to the browser.
 * Presigned URLs come only from the staging figures API.
 */
export function publicFigureAssetsForUi(assets: FigureAssets): Pick<
  FigureAssets,
  "projectId" | "status" | "errorCode" | "createdAt" | "updatedAt"
> {
  return {
    projectId: assets.projectId,
    status: assets.status,
    errorCode: assets.status === "failed" ? assets.errorCode : undefined,
    createdAt: assets.createdAt,
    updatedAt: assets.updatedAt
  };
}

export function arEnabledFromAssets(
  assets: Pick<FigureAssets, "status" | "usdzKey"> | { status: FigureAssetStatus; usdzUrl?: string }
): boolean {
  if (assets.status !== "ready") return false;
  if ("usdzKey" in assets && assets.usdzKey) return true;
  if ("usdzUrl" in assets && assets.usdzUrl) return true;
  return false;
}

export type FigureStagingGuardInput = {
  jobEnvironment: string;
  r2Bucket: string | undefined | null;
  stagingBucket: string | undefined | null;
  appwriteProjectId: string | undefined | null;
  productionAppwriteProjectId: string | undefined | null;
  /** When set, bucket must equal this exact name (default: kidar-figures-staging). */
  expectedBucketName?: string;
};

/**
 * Fail closed unless the job, R2 bucket, and Appwrite project are all staging.
 * Prevents accidental writes into production R2 or production Appwrite.
 */
export function assertFigureStagingEnvironment(input: FigureStagingGuardInput): void {
  if (input.jobEnvironment !== FIGURE_STAGING_ENVIRONMENT) {
    throw new FigureStagingError("Figure generation job must target staging", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }

  const bucket = (input.r2Bucket || "").trim();
  const stagingBucket = (input.stagingBucket || "").trim();
  const expected = (input.expectedBucketName || FIGURE_STAGING_BUCKET_NAME).trim();
  if (!bucket || !stagingBucket) {
    throw new FigureStagingError("Staging R2 bucket is not configured", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  if (bucket !== stagingBucket) {
    throw new FigureStagingError("R2 bucket is not the declared staging bucket", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  if (bucket !== expected) {
    throw new FigureStagingError("R2 bucket must be the dedicated staging figures bucket", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }

  const appwrite = (input.appwriteProjectId || "").trim();
  const production = (input.productionAppwriteProjectId || "").trim();
  if (!appwrite) {
    throw new FigureStagingError("Appwrite project id is required for staging jobs", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
  if (production && appwrite === production) {
    throw new FigureStagingError("Staging figure jobs cannot use the production Appwrite project", {
      retryable: false,
      code: "STAGING_GUARD"
    });
  }
}

export function createInitialFigureAssets(projectId: string, now = new Date()): FigureAssets {
  const iso = now.toISOString();
  return {
    projectId,
    status: "pending",
    createdAt: iso,
    updatedAt: iso
  };
}

export function markFigureAssetsProcessing(assets: FigureAssets, now = new Date()): FigureAssets {
  return {
    ...assets,
    status: "processing",
    glbKey: undefined,
    usdzKey: undefined,
    posterKey: undefined,
    errorCode: undefined,
    updatedAt: now.toISOString()
  };
}

export function markFigureAssetsReady(
  assets: FigureAssets,
  keys: { jobId: string; glbKey: string; usdzKey: string; posterKey?: string },
  now = new Date()
): FigureAssets {
  const glbKey = assertFigureStagingObjectKey(assets.projectId, keys.glbKey, "glb");
  const usdzKey = assertFigureStagingObjectKey(assets.projectId, keys.usdzKey, "usdz");
  return {
    ...assets,
    status: "ready",
    jobId: safeSegment(keys.jobId) || keys.jobId,
    glbKey,
    usdzKey,
    posterKey: keys.posterKey,
    errorCode: undefined,
    updatedAt: now.toISOString()
  };
}

export function markFigureAssetsFailed(
  assets: FigureAssets,
  errorCode: FigureStagingErrorCode,
  now = new Date()
): FigureAssets {
  return {
    projectId: assets.projectId,
    status: "failed",
    errorCode,
    createdAt: assets.createdAt,
    updatedAt: now.toISOString()
  };
}

export function figureStagingUiMessage(status: FigureAssetStatus, errorCode?: string): string {
  if (status === "ready") return "Figurina 3D este gata";
  if (status === "failed") {
    if (errorCode === "STAGING_GUARD") return "Mediul de test nu este configurat corect";
    return "Nu am putut pregăti figurina 3D";
  }
  return "Figurina 3D se pregătește";
}

/** Ready metadata that has both object keys (presign inputs). */
export function figureAssetsReadyKeys(
  assets: FigureAssets
): { jobId: string; glbKey: string; usdzKey: string } | null {
  if (assets.status !== "ready" || !assets.glbKey || !assets.usdzKey) return null;
  try {
    const glbKey = assertFigureStagingObjectKey(assets.projectId, assets.glbKey, "glb");
    const usdzKey = assertFigureStagingObjectKey(assets.projectId, assets.usdzKey, "usdz");
    const jobId =
      assets.jobId ||
      extractJobIdFromStagingKey(glbKey, assets.projectId) ||
      "";
    if (!jobId) return null;
    return { jobId, glbKey, usdzKey };
  } catch {
    return null;
  }
}
