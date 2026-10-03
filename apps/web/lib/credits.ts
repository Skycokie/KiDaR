/**
 * Figurină 3D Tripo credit helpers.
 * Production always enforces credits. Local UI may set BYPASS_CREDITS=true
 * in `.env.local` — only honored when NODE_ENV is development.
 */

/** Credits consumed by one new figurine_build enqueue. */
export const FIGURINE_CREDIT_COST = 1;

export function isCreditsBypassEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (env.NODE_ENV !== "development") return false;
  return env.BYPASS_CREDITS === "1" || env.BYPASS_CREDITS === "true";
}

/** Credits granted by one successful Stripe Checkout. Requires env. */
export function creditsPerStripePack(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): number | null {
  const raw = (env.STRIPE_CREDITS_PER_PACK ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}
