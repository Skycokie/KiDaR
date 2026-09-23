/**
 * Project-creation quota helpers.
 * Production always enforces plan limits. Local UI work may set BYPASS_QUOTA=true
 * in `.env.local` — only honored when NODE_ENV is development.
 */
export function isQuotaBypassEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV !== "development") return false;
  return env.BYPASS_QUOTA === "1" || env.BYPASS_QUOTA === "true";
}

export function projectQuotaLimit(plan: "free" | "paid"): number {
  return plan === "paid" ? 30 : 3;
}
