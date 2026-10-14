import { describe, expect, it } from "vitest";
import { limitAssistantPrompt, parseAssistantReply } from "./schema";

describe("parseAssistantReply", () => {
  it("accepts whitelisted fields", () => {
    expect(
      parseAssistantReply({
        reply: "Hai să plutești printre stele!",
        motion: "float",
        decor: "stars",
        palette: "bright",
        lighting: "warm",
        intent: "suggest_3d"
      })
    ).toEqual({
      reply: "Hai să plutești printre stele!",
      motion: "float",
      decor: "stars",
      palette: "bright",
      lighting: "warm",
      intent: "suggest_3d"
    });
  });

  it("drops invalid enum values and defaults intent", () => {
    expect(
      parseAssistantReply({
        reply: "ok",
        motion: "swim",
        decor: "dragon",
        intent: "hack"
      })
    ).toEqual({ reply: "ok", intent: "none" });
  });

  it("rejects empty useless payloads", () => {
    expect(parseAssistantReply({})).toBeNull();
    expect(parseAssistantReply({ intent: "none" })).toBeNull();
    expect(parseAssistantReply(null)).toBeNull();
  });

  it("trims and caps reply length", () => {
    const long = "x".repeat(300);
    const parsed = parseAssistantReply({ reply: long, motion: "wave" });
    expect(parsed?.reply).toHaveLength(160);
  });
});

describe("limitAssistantPrompt", () => {
  it("caps at 240 chars", () => {
    expect(limitAssistantPrompt("a".repeat(300)).length).toBe(240);
  });
});
