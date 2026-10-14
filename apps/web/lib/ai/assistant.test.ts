import { describe, expect, it, vi } from "vitest";
import { runStudioAssistant } from "./assistant";
import type { StudioAiProvider } from "./provider";

describe("runStudioAssistant", () => {
  it("uses AI when moderation passes and provider returns whitelist output", async () => {
    const provider: StudioAiProvider = {
      complete: vi.fn().mockResolvedValue({
        reply: "Plutește printre stele.",
        motion: "float",
        decor: "stars",
        intent: "none"
      })
    };
    const result = await runStudioAssistant(
      { prompt: "the fish is swimming among stars", locale: "en" },
      {
        provider,
        moderation: {
          apiKey: "test",
          fetchImpl: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ results: [{ flagged: false, categories: {} }] })
          })
        }
      }
    );
    expect(result.source).toBe("ai");
    expect(result.reply.motion).toBe("float");
    expect(result.reply.decor).toBe("stars");
  });

  it("blocks when moderation flags the text", async () => {
    const provider: StudioAiProvider = { complete: vi.fn() };
    const result = await runStudioAssistant(
      { prompt: "bad content", locale: "en" },
      {
        provider,
        moderation: {
          apiKey: "test",
          fetchImpl: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              results: [{ flagged: true, categories: { violence: true } }]
            })
          })
        }
      }
    );
    expect(result.source).toBe("blocked");
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("falls back to local keywords when AI returns null", async () => {
    const provider: StudioAiProvider = { complete: vi.fn().mockResolvedValue(null) };
    const result = await runStudioAssistant(
      { prompt: "float among the stars", locale: "en" },
      {
        provider,
        moderation: {
          apiKey: "test",
          fetchImpl: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ results: [{ flagged: false }] })
          })
        }
      }
    );
    expect(result.source).toBe("local");
    expect(result.reply.motion).toBe("float");
    expect(result.reply.decor).toBe("stars");
  });
});
