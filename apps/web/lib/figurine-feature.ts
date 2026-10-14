/**
 * Figurină 3D feature flag for the web app (Vercel).
 *
 * Never read TRIPO_API_KEY here — Tripo credentials live only on the worker.
 * Never use NEXT_PUBLIC_* for this flag if you want to keep rollout server-gated.
 *
 * Generation is on when either FIGURE_GENERATION_ENABLED=true or
 * FIGURINE_3D_ENABLED is true/1 — same rule as the worker.
 */

import { isFigureGenerationEnabled } from "@kidar/core";

/** Explicit product switch. Default off until ops enable generation. */
export function isFigurineFeatureEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return isFigureGenerationEnabled(env);
}
