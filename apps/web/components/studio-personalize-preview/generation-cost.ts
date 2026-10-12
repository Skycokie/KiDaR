/**
 * 3D generation cost gate.
 *
 * `main` has no server-side price or credit contract for the Figurină 3D job, so the cost is
 * unverifiable. Until a real, server-verified source exists:
 * - the confirmation dialog cannot be confirmed,
 * - the client helper refuses to send the job,
 * - the chat never offers generation.
 * Never show "free", a price or an estimated consumption without a verified source.
 */

export type GenerationCost = { status: "unverified" } | { status: "verified"; summary: string };

/** No verifiable source exists today. Replace only with a real, server-side contract. */
export const CURRENT_GENERATION_COST: GenerationCost = { status: "unverified" };

export function canConfirmGeneration(cost: GenerationCost): boolean {
  return cost.status === "verified";
}

/** The chat can describe the 3D step but must never start it. */
export const CHAT_GENERATION_ENABLED = false as const;
