import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { ro } from "@/i18n/messages/ro";
import { startFigurineGeneration } from "./generate-figurine";
import { canConfirmGeneration, CHAT_GENERATION_ENABLED, CURRENT_GENERATION_COST } from "./generation-cost";

afterEach(() => vi.unstubAllGlobals());

describe("generation cost gate", () => {
  it("treats the current cost as unverifiable, so confirmation is not possible", () => {
    expect(CURRENT_GENERATION_COST).toEqual({ status: "unverified" });
    expect(canConfirmGeneration(CURRENT_GENERATION_COST)).toBe(false);
    expect(canConfirmGeneration({ status: "verified", summary: "x" })).toBe(true);
    expect(CHAT_GENERATION_ENABLED).toBe(false);
  });

  it("never sends the job while the cost is unverifiable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(startFigurineGeneration("p1")).resolves.toEqual({ ok: false, error: "cost_unverified" });
    await expect(startFigurineGeneration("p1", CURRENT_GENERATION_COST)).resolves.toEqual({
      ok: false,
      error: "cost_unverified"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only a verified source can reach the existing confirmed POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 201, json: async () => ({ label: "queued" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      startFigurineGeneration("p1", { status: "verified", summary: "from a real server source" })
    ).resolves.toEqual({ ok: true, label: "queued" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects/p1/figurine");
  });

  it("explains the blocked state in both locales without inventing a price", () => {
    expect(ro.personalize.figurineErrors.cost_unverified).toBe(
      "Generarea este indisponibilă momentan; costul nu poate fi verificat."
    );
    expect(en.personalize.figurineErrors.cost_unverified).toBe(
      "Generation is unavailable right now; the cost cannot be verified."
    );
    for (const text of [ro.chat.generateDialog.costUnverified, en.chat.generateDialog.costUnverified]) {
      expect(text.toLowerCase()).not.toMatch(/gratuit|free\b|€|\$|lei\b/);
    }
  });
});
