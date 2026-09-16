/**
 * Shared validation for absolute public consumer URLs (AR assets, QR targets).
 * Rejects credentials, dangerous schemes, and detectable signed/private URL patterns.
 */

export class PublicUrlError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_PUBLIC_URL") {
    super(message);
    this.name = "PublicUrlError";
    this.code = code;
  }
}

export interface PublicUrlOptions {
  /** When true, allow http(s) to localhost / 127.0.0.1 / ::1 for tests. */
  allowLocalOrigins?: boolean;
  /** Optional lowercase path suffix requirement (e.g. ".mind"). */
  requirePathSuffix?: string;
  label?: string;
}

const SIGNED_OR_PRIVATE_QUERY = new Set([
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
  "x-amz-expires",
  "x-goog-signature",
  "x-goog-credential",
  "signature",
  "sig",
  "token",
  "access_token",
  "expires",
  "expire",
  "x-appwrite-jwt"
]);

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function looksLikePrivateOrSignedUrl(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (SIGNED_OR_PRIVATE_QUERY.has(key.toLowerCase())) {
      return true;
    }
  }

  const path = url.pathname.toLowerCase();
  // Appwrite private file proxy / storage download shapes (not public CDN).
  if (path.includes("/v1/storage/") && path.includes("/files/") && path.includes("/download")) {
    return true;
  }
  if (path.includes("/api/files/")) {
    return true;
  }

  return false;
}

/**
 * Parse and validate an absolute public URL suitable for consumer AR pages / QR codes.
 */
export function assertPublicAbsoluteUrl(raw: string, options: PublicUrlOptions = {}): URL {
  const label = options.label ?? "url";
  if (typeof raw !== "string" || !raw.trim()) {
    throw new PublicUrlError(`${label} is required`, "MISSING_URL");
  }

  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PublicUrlError(`${label} is not a valid absolute URL`, "MALFORMED_URL");
  }

  if (parsed.username || parsed.password) {
    throw new PublicUrlError(`${label} must not embed credentials`, "CREDENTIALS_IN_URL");
  }

  const protocol = parsed.protocol.toLowerCase();
  const local = isLocalHostname(parsed.hostname);
  const allowLocal = Boolean(options.allowLocalOrigins) && local;

  if (protocol === "https:") {
    // ok
  } else if (allowLocal && (protocol === "http:" || protocol === "https:")) {
    // controlled local test origins only
  } else if (protocol === "http:" && !allowLocal) {
    throw new PublicUrlError(`${label} must use https: (http only for local test origins)`, "INSECURE_URL");
  } else {
    throw new PublicUrlError(
      `${label} uses unsupported scheme ${protocol} (https required)`,
      "UNSUPPORTED_SCHEME"
    );
  }

  if (looksLikePrivateOrSignedUrl(parsed)) {
    throw new PublicUrlError(
      `${label} looks like a private or signed URL and cannot be embedded`,
      "PRIVATE_OR_SIGNED_URL"
    );
  }

  if (options.requirePathSuffix) {
    const suffix = options.requirePathSuffix.toLowerCase();
    if (!parsed.pathname.toLowerCase().endsWith(suffix)) {
      throw new PublicUrlError(`${label} path must end with ${suffix}`, "INVALID_PATH_SUFFIX");
    }
  }

  return parsed;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape for double-quoted HTML attribute values (also escapes backticks). */
export function escapeHtmlAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/** JSON-encode a string for safe embedding inside a <script> string literal. */
export function escapeJsString(value: string): string {
  return JSON.stringify(value);
}
