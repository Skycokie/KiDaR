import { describe, expect, it } from "vitest";
import {
  AI_CHAT_HOUR_LIMIT,
  consumeAiChatQuota,
  createMemoryAiUsageStore,
  dayBucket,
  hourBucket,
  usageDocId
} from "./usage";

describe("ai usage quota", () => {
  it("allows up to the hourly limit then rate-limits", async () => {
    const store = createMemoryAiUsageStore();
    const now = new Date("2026-10-10T15:00:00.000Z");
    for (let i = 0; i < AI_CHAT_HOUR_LIMIT; i++) {
      const ok = await consumeAiChatQuota("user1", { store, now });
      expect(ok.ok).toBe(true);
    }
    const blocked = await consumeAiChatQuota("user1", { store, now });
    expect(blocked).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("builds stable doc ids", () => {
    const now = new Date("2026-10-10T15:30:00.000Z");
    expect(hourBucket(now)).toBe("2026101015");
    expect(dayBucket(now)).toBe("20261010");
    expect(usageDocId("abc", "2026101015")).toBe("abc_2026101015");
  });

  it("reports store_missing when store cannot read", async () => {
    const store = {
      readCount: async () => null,
      writeCount: async () => undefined
    };
    await expect(consumeAiChatQuota("u", { store })).resolves.toEqual({
      ok: false,
      code: "store_missing"
    });
  });
});
