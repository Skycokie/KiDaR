/**
 * Server-only staging runtime gate.
 * Production (kidar-studio.vercel.app) leaves KIDAR_RUNTIME_ENV unset → internal AR routes 404.
 */
export function isStagingRuntime(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = (env.KIDAR_RUNTIME_ENV || "").trim().toLowerCase();
  return value === "staging";
}
