/**
 * Server-side cost gate for Figurină 3D generation.
 *
 * Tripo calls are paid and there is no credit / pricing / quota source the server can
 * verify yet. Until one exists this stays "unverified" and every server entry point that
 * can create a `figurine_build` job (the figurine route and `POST /api/publish`) refuses
 * before any project write, enqueue or provider call. The decision is NEVER derived from
 * the request: a client-sent `confirm`, price or credit field is not cost verification,
 * and project `settings` are owner-writable so they are not evidence either.
 *
 * When a real server-side source exists, it must be wired in here (and only here).
 *
 * The only thing that may pass publish without a verified cost is REUSING a finished model
 * (no new job, no Tripo call); that proof lives in lib/figurine-reuse.ts.
 */

export type FigurineCostState = { status: "unverified" } | { status: "verified" };

export function verifyFigurineCost(): FigurineCostState {
  return { status: "unverified" };
}

export const FIGURINE_COST_UNVERIFIED_BODY = {
  error: "cost_unverified",
  message: "Figurină 3D generation is unavailable until its cost can be verified."
} as const;