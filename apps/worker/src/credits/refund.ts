/**
 * Refund Tripo credits when a figurine job fails before any Tripo task id exists.
 * Worker-only; uses admin Appwrite key.
 */

import type { PipelineJob } from "@kidar/core";
import { createWorkerAppwrite } from "../appwrite/client";

function parsePayloadBag(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Refund when terminal failure and Tripo never received a paid submit.
 * providerTaskId present ⇒ credits stay spent.
 */
export async function maybeRefundFigurineCredits(input: {
  job: PipelineJob;
  persistedResult: Record<string, unknown>;
  terminal: boolean;
}): Promise<void> {
  if (!input.terminal) return;
  const providerTaskId =
    typeof input.persistedResult.providerTaskId === "string"
      ? input.persistedResult.providerTaskId.trim()
      : "";
  if (providerTaskId) return;

  const { databases, databaseId, jobsCollection, profilesCollection } = createWorkerAppwrite();
  const jobDoc = await databases.getDocument(databaseId, jobsCollection, input.job.id);
  const bag = parsePayloadBag((jobDoc as { payload?: unknown }).payload);
  if (bag.creditsRefunded === true) return;

  const creditsDebitedRaw = bag.creditsDebited;
  const creditsDebited =
    typeof creditsDebitedRaw === "number" && Number.isFinite(creditsDebitedRaw)
      ? Math.max(0, Math.floor(creditsDebitedRaw))
      : 0;
  const creditsOwnerId =
    typeof bag.creditsOwnerId === "string" && bag.creditsOwnerId.trim()
      ? bag.creditsOwnerId.trim()
      : null;
  if (creditsDebited < 1 || !creditsOwnerId) return;

  const profileDoc = await databases.getDocument(databaseId, profilesCollection, creditsOwnerId);
  const data = profileDoc as { credits?: unknown };
  const current =
    typeof data.credits === "number" && Number.isFinite(data.credits)
      ? Math.max(0, Math.floor(data.credits))
      : 0;
  await databases.updateDocument(databaseId, profilesCollection, creditsOwnerId, {
    credits: current + creditsDebited
  });

  const { result: _r, ...extra } = bag;
  await databases.updateDocument(databaseId, jobsCollection, input.job.id, {
    payload: JSON.stringify({
      ...extra,
      creditsRefunded: true,
      result: input.job.result ?? bag.result ?? null,
      input_hash: input.job.inputHash || bag.input_hash,
      artifact_hash: input.job.artifactHash ?? bag.artifact_hash ?? null,
      last_error: input.job.lastError ?? bag.last_error ?? null
    })
  });
}
