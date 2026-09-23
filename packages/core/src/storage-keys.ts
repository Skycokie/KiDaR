/**
 * Public object-key and CDN URL rules for consumer artifacts (R2).
 * Never emit signed URLs or use the S3 API endpoint as a public origin.
 */

import { assertPublicAbsoluteUrl, PublicUrlError } from "./public-url";
import { PublicStorageConfigError } from "./storage-error";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const R2_VERIFY_KEY_PREFIX = "__kidar_verify__/";

export const PUBLIC_ARTIFACT_CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  glb: "model/gltf-binary",
  usdz: "model/vnd.usdz+zip",
  mind: "application/octet-stream",
  png: "image/png",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  js: "text/javascript; charset=utf-8"
} as const;

export type PublicArtifactContentType =
  (typeof PUBLIC_ARTIFACT_CONTENT_TYPES)[keyof typeof PUBLIC_ARTIFACT_CONTENT_TYPES];

const MAX_KEY_LENGTH = 1024;

export class PublicObjectKeyError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_OBJECT_KEY") {
    super(message);
    this.name = "PublicObjectKeyError";
    this.code = code;
  }
}

export function defaultR2ApiEndpoint(accountId: string): string {
  return `https://${accountId.trim()}.r2.cloudflarestorage.com`;
}

export function isR2ApiHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "r2.cloudflarestorage.com" || host.endsWith(".r2.cloudflarestorage.com");
}

function decodeOnce(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, "%20"));
  } catch {
    throw new PublicObjectKeyError("object key contains invalid percent-encoding", "MALFORMED_KEY");
  }
}

/**
 * Normalize a caller-provided object key for R2 Put/Head and public URL join.
 * Rejects traversal, query strings, credentials, and leading slashes.
 */
export function normalizePublicObjectKey(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new PublicObjectKeyError("object key is required", "MISSING_KEY");
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("/")) {
    throw new PublicObjectKeyError("object key must not start with /", "LEADING_SLASH");
  }
  if (trimmed.includes("\\")) {
    throw new PublicObjectKeyError("object key must not contain backslashes", "INVALID_KEY_CHAR");
  }
  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new PublicObjectKeyError("object key must not include query or fragment", "KEY_HAS_QUERY");
  }
  if (trimmed.includes("@") || trimmed.includes("://")) {
    throw new PublicObjectKeyError("object key must not include credentials or a URL scheme", "KEY_HAS_URL");
  }
  if (trimmed.length > MAX_KEY_LENGTH) {
    throw new PublicObjectKeyError(`object key must be ≤ ${MAX_KEY_LENGTH} characters`, "KEY_TOO_LONG");
  }

  const parts = trimmed.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new PublicObjectKeyError("object key is required", "MISSING_KEY");
  }

  const normalized: string[] = [];
  for (const part of parts) {
    const decoded = decodeOnce(part);
    if (decoded === "." || decoded === "..") {
      throw new PublicObjectKeyError("object key must not contain path traversal", "KEY_TRAVERSAL");
    }
    if (decoded.includes("/") || decoded.includes("\\")) {
      throw new PublicObjectKeyError("object key segments must not expand to extra separators", "KEY_TRAVERSAL");
    }
    if (decoded.includes("\0")) {
      throw new PublicObjectKeyError("object key must not contain NUL", "INVALID_KEY_CHAR");
    }
    normalized.push(decoded);
  }

  return normalized.join("/");
}

/**
 * Build an unsigned public HTTPS URL: `R2_PUBLIC_BASE_URL` + normalized key.
 * Encodes path segments deterministically. Never adds query parameters.
 */
export function publicArtifactUrl(publicBaseUrl: string, key: string, options?: { allowLocalOrigins?: boolean }): string {
  const normalizedKey = normalizePublicObjectKey(key);
  let base: URL;
  try {
    base = assertPublicAbsoluteUrl(publicBaseUrl, {
      allowLocalOrigins: options?.allowLocalOrigins,
      label: "R2_PUBLIC_BASE_URL"
    });
  } catch (error) {
    if (error instanceof PublicUrlError) {
      throw new PublicStorageConfigError(error.message);
    }
    throw error;
  }

  if (base.search || base.hash) {
    throw new PublicStorageConfigError(
      "R2_PUBLIC_BASE_URL must not include query parameters or fragments (unsigned CDN origin only)."
    );
  }
  if (isR2ApiHostname(base.hostname)) {
    throw new PublicStorageConfigError(
      "R2_PUBLIC_BASE_URL must be the public HTTPS delivery origin, not the S3-compatible R2 API endpoint."
    );
  }

  const prefix = base.pathname.replace(/\/+$/, "");
  const encodedKey = normalizedKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base.origin}${prefix}/${encodedKey}`;
}

/**
 * Validate R2 public origin vs S3 API endpoint after env resolution.
 */
export function assertR2UrlRoles(input: {
  publicBaseUrl: string;
  endpoint?: string;
  accountId: string;
  allowLocalOrigins?: boolean;
}): { publicBaseUrl: string; endpoint: string } {
  const probe = new URL(
    publicArtifactUrl(input.publicBaseUrl, "probe.txt", {
      allowLocalOrigins: input.allowLocalOrigins
    })
  );
  const publicBaseUrl = `${probe.origin}${probe.pathname.replace(/\/probe\.txt$/, "")}`.replace(
    /\/$/,
    ""
  );

  const endpointRaw = input.endpoint?.trim() || defaultR2ApiEndpoint(input.accountId);
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpointRaw);
  } catch {
    throw new PublicStorageConfigError("R2_ENDPOINT is not a valid absolute URL.");
  }
  if (endpointUrl.protocol !== "https:") {
    throw new PublicStorageConfigError("R2_ENDPOINT must use https.");
  }
  if (endpointUrl.username || endpointUrl.password || endpointUrl.search || endpointUrl.hash) {
    throw new PublicStorageConfigError("R2_ENDPOINT must not include credentials, query, or fragment.");
  }
  if (probe.hostname === endpointUrl.hostname) {
    throw new PublicStorageConfigError(
      "R2_PUBLIC_BASE_URL must differ from R2_ENDPOINT. Use a public CDN/custom hostname for delivery and the account S3 API host for worker writes."
    );
  }

  return { publicBaseUrl, endpoint: endpointUrl.origin };
}
