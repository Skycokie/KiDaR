/**
 * Per-account AI chat rate limits stored in Appwrite collection `ai_usage`.
 * Document id: `${userId}_${bucket}` where bucket is hourly (`2026101015`) or daily (`20261010`).
 *
 * Collection attributes (string): userId, bucket, kind ("hour"|"day"), count (integer).
 * Permissions: server API key only (no client access).
 */

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_AI_USAGE_COLLECTION
} from "@/lib/appwrite/config";
import { createAdminClient } from "@/lib/appwrite/client";

export const AI_CHAT_HOUR_LIMIT = 10;
export const AI_CHAT_DAY_LIMIT = 30;

export type AiUsageDecision =
  | { ok: true; hourCount: number; dayCount: number }
  | { ok: false; code: "rate_limited" | "store_missing" | "store_error"; hourCount?: number; dayCount?: number };

export type AiUsageStore = {
  readCount(docId: string): Promise<number | null>;
  writeCount(docId: string, fields: { userId: string; bucket: string; kind: "hour" | "day"; count: number }): Promise<void>;
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function hourBucket(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}`;
}

export function dayBucket(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
}

export function usageDocId(userId: string, bucket: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36) || "user";
  return `${safeUser}_${bucket}`.slice(0, 36);
}

export function createAppwriteAiUsageStore(): AiUsageStore {
  return {
    async readCount(docId) {
      try {
        const { databases } = createAdminClient();
        const doc = await databases.getDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_USAGE_COLLECTION,
          docId
        );
        const count = typeof doc.count === "number" ? doc.count : Number(doc.count);
        return Number.isFinite(count) ? count : 0;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (/not found|404|document_not_found/i.test(message)) return 0;
        if (/collection|404|unknown/i.test(message)) return null;
        throw cause;
      }
    },
    async writeCount(docId, fields) {
      const { databases } = createAdminClient();
      try {
        await databases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_USAGE_COLLECTION,
          docId,
          { count: fields.count }
        );
      } catch {
        await databases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_USAGE_COLLECTION,
          docId,
          fields
        );
      }
    }
  };
}

/** In-memory store for unit tests. */
export function createMemoryAiUsageStore(): AiUsageStore & { map: Map<string, number> } {
  const map = new Map<string, number>();
  return {
    map,
    async readCount(docId) {
      return map.get(docId) ?? 0;
    },
    async writeCount(docId, fields) {
      map.set(docId, fields.count);
    }
  };
}

export async function consumeAiChatQuota(
  userId: string,
  opts: {
    store?: AiUsageStore;
    now?: Date;
    hourLimit?: number;
    dayLimit?: number;
  } = {}
): Promise<AiUsageDecision> {
  const store = opts.store ?? createAppwriteAiUsageStore();
  const now = opts.now ?? new Date();
  const hourLimit = opts.hourLimit ?? AI_CHAT_HOUR_LIMIT;
  const dayLimit = opts.dayLimit ?? AI_CHAT_DAY_LIMIT;

  const hour = hourBucket(now);
  const day = dayBucket(now);
  const hourId = usageDocId(userId, hour);
  const dayId = usageDocId(userId, day);

  let hourCount: number;
  let dayCount: number;
  try {
    const hourRead = await store.readCount(hourId);
    const dayRead = await store.readCount(dayId);
    if (hourRead === null || dayRead === null) {
      return { ok: false, code: "store_missing" };
    }
    hourCount = hourRead;
    dayCount = dayRead;
  } catch {
    return { ok: false, code: "store_error" };
  }

  if (hourCount >= hourLimit || dayCount >= dayLimit) {
    return { ok: false, code: "rate_limited", hourCount, dayCount };
  }

  try {
    await store.writeCount(hourId, {
      userId,
      bucket: hour,
      kind: "hour",
      count: hourCount + 1
    });
    await store.writeCount(dayId, {
      userId,
      bucket: day,
      kind: "day",
      count: dayCount + 1
    });
  } catch {
    return { ok: false, code: "store_error", hourCount, dayCount };
  }

  return { ok: true, hourCount: hourCount + 1, dayCount: dayCount + 1 };
}

/** Probe collection existence without consuming quota. */
export async function isAiUsageStoreReady(
  store: AiUsageStore = createAppwriteAiUsageStore()
): Promise<boolean> {
  try {
    const probe = await store.readCount("__probe_missing__");
    return probe !== null;
  } catch {
    return false;
  }
}
