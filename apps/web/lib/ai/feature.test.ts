import { describe, expect, it } from "vitest";
import { isFigureText3dEnabled, isStudioAiChatEnabled, resolveAiChatModel } from "./feature";

describe("AI feature flags", () => {
  it("defaults off", () => {
    expect(isStudioAiChatEnabled({})).toBe(false);
    expect(isFigureText3dEnabled({})).toBe(false);
  });

  it("honors explicit true aliases", () => {
    expect(isStudioAiChatEnabled({ STUDIO_AI_CHAT_ENABLED: "true" })).toBe(true);
    expect(isStudioAiChatEnabled({ STUDIO_AI_CHAT_ENABLED: "1" })).toBe(true);
    expect(isFigureText3dEnabled({ FIGURE_TEXT_3D_ENABLED: "1" })).toBe(true);
  });

  it("defaults model to gpt-4o-mini", () => {
    expect(resolveAiChatModel({})).toBe("gpt-4o-mini");
    expect(resolveAiChatModel({ AI_CHAT_MODEL: "gpt-4.1-mini" })).toBe("gpt-4.1-mini");
  });
});
