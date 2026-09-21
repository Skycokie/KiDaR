/**
 * Server-only Tripo OpenAPI v3 configuration.
 * Never import from client bundles. Never use NEXT_PUBLIC_TRIPO_*.
 */

export const TRIPO_DEFAULT_BASE_URL = "https://openapi.tripo3d.ai/v3";

/** Documented H3 model id for image-to-model (Tripo developers docs). */
export const TRIPO_IMAGE_TO_MODEL_MODEL = "v3.1-20260211";

export class TripoConfigError extends Error {
  readonly code = "TRIPO_CONFIG_MISSING";

  constructor(message = "TRIPO_API_KEY is required for Figurină 3D") {
    super(message);
    this.name = "TripoConfigError";
  }
}

export type TripoConfig = {
  apiKey: string;
  baseUrl: string;
};

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

/** Soft check — does not throw. Used for UI availability. */
export function isTripoConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return present(env.TRIPO_API_KEY);
}

/**
 * Fail closed when Figurine 3D is requested without server config.
 * Pop-out must not call this.
 */
export function requireTripoConfig(env: NodeJS.ProcessEnv = process.env): TripoConfig {
  if (!present(env.TRIPO_API_KEY)) {
    throw new TripoConfigError();
  }
  const baseUrl = (env.TRIPO_BASE_URL || TRIPO_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new TripoConfigError("TRIPO_BASE_URL must be an https origin");
  }
  return {
    apiKey: env.TRIPO_API_KEY!.trim(),
    baseUrl
  };
}
