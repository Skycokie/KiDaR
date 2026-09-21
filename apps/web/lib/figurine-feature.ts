/**
 * Figurină 3D feature flag for the web app (Vercel).
 *
 * Never read TRIPO_API_KEY here — Tripo credentials live only on the Hetzner worker.
 * Never use NEXT_PUBLIC_* for this flag if you want to keep rollout server-gated;
 * Studio asks a server endpoint / reads server-only FIGURINE_3D_ENABLED.
 */

/** Explicit product switch. Default off until ops set true after worker Go C is live. */
export function isFigurineFeatureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FIGURINE_3D_ENABLED === "1" || env.FIGURINE_3D_ENABLED === "true";
}
