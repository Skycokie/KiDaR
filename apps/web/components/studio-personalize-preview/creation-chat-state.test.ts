import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AssistantClientResult } from "./assistant-client";
import {
  buildHistory,
  cardsFromResult,
  chatAvailability,
  isSendKey,
  isTerminalChatError,
  runChatTurn,
  validateChatInput,
  type ChatMessage
} from "./creation-chat-state";
import { CHAT_GENERATION_ENABLED } from "./generation-cost";

const ok = (over: Partial<Extract<AssistantClientResult, { ok: true }>> = {}) =>
  ({
    ok: true,
    source: "ai",
    reply: "Bine!",
    intent: "none",
    settings: { motion: null, decor: null, palette: null, lighting: null },
    suggestions: [],
    usage: { hourCount: 1, dayCount: 1, hourLimit: 10, dayLimit: 30 },
    ...over
  }) as Extract<AssistantClientResult, { ok: true }>;

const message = (over: Partial<ChatMessage> & Pick<ChatMessage, "role" | "text">): ChatMessage => ({
  id: Math.random().toString(36).slice(2),
  cards: [],
  ...over
});

describe("chat availability", () => {
  it("is disabled without a project", () => {
    expect(chatAvailability(null)).toBe("no_project");
    expect(chatAvailability(undefined)).toBe("no_project");
    expect(chatAvailability("")).toBe("no_project");
    expect(chatAvailability("p1")).toBe("ready");
  });
});

describe("runChatTurn", () => {
  const base = { locale: "ro" as const, messages: [] as ChatMessage[] };

  it("makes no request at all when there is no project", async () => {
    const request = vi.fn();
    await expect(runChatTurn({ ...base, projectId: null, text: "hello", request })).resolves.toEqual({
      kind: "unavailable"
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", "", "empty"],
    ["blank", "   ", "empty"],
    ["too long", "x".repeat(241), "too_long"]
  ])("makes no request for %s input", async (_name, text, reason) => {
    const request = vi.fn();
    await expect(runChatTurn({ ...base, projectId: "p1", text, request })).resolves.toEqual({
      kind: "invalid",
      reason
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("sends the trimmed text with the completed history only", async () => {
    const request = vi.fn().mockResolvedValue(ok({ reply: "Hello!" }));
    const messages = [
      message({ role: "user", text: "a dragon" }),
      message({ role: "assistant", text: "Nice" }),
      message({ role: "user", text: "failed one", status: "failed", error: "network" }),
      message({ role: "user", text: "blocked one", status: "blocked" })
    ];
    const outcome = await runChatTurn({ projectId: "p1", text: "  make it friendly  ", locale: "en", messages, request });
    expect(request).toHaveBeenCalledWith("p1", "make it friendly", "en", [
      { role: "user", content: "a dragon" },
      { role: "assistant", content: "Nice" }
    ]);
    expect(outcome).toMatchObject({ kind: "ok", reply: "Hello!" });
  });

  it("maps blocked, and error results", async () => {
    await expect(
      runChatTurn({ ...base, projectId: "p1", text: "x", request: vi.fn().mockResolvedValue(ok({ source: "blocked" })) })
    ).resolves.toMatchObject({ kind: "blocked" });
    await expect(
      runChatTurn({
        ...base,
        projectId: "p1",
        text: "x",
        request: vi.fn().mockResolvedValue({ ok: false, error: "moderation" })
      })
    ).resolves.toEqual({ kind: "error", error: "moderation" });
  });
});

describe("buildHistory", () => {
  it("keeps only the last 6 completed text turns", () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      message({ role: i % 2 === 0 ? "user" : "assistant", text: `turn ${i}` })
    );
    const history = buildHistory(messages);
    expect(history).toHaveLength(6);
    expect(history[0]).toEqual({ role: "user", content: "turn 4" });
    expect(history[5]).toEqual({ role: "assistant", content: "turn 9" });
  });

  it("never includes cards, ids, settings or empty messages", () => {
    const history = buildHistory([
      message({
        role: "assistant",
        text: "Here",
        cards: [{ kind: "settings", settings: { motion: "wave", decor: null, palette: null, lighting: null } }]
      }),
      message({ role: "assistant", text: "   " })
    ]);
    expect(history).toEqual([{ role: "assistant", content: "Here" }]);
    expect(Object.keys(history[0]).sort()).toEqual(["content", "role"]);
  });
});

describe("cardsFromResult", () => {
  it("offers a settings card only for whitelisted values", () => {
    const cards = cardsFromResult(
      ok({ settings: { motion: "float", decor: "volcano", palette: null, lighting: "warm" } })
    );
    expect(cards).toEqual([
      { kind: "settings", settings: { motion: "float", decor: null, palette: null, lighting: "warm" } }
    ]);
    expect(
      cardsFromResult(ok({ settings: { motion: "teleport", decor: null, palette: null, lighting: null } }))
    ).toEqual([]);
  });

  it("turns suggestions into text-only cards", () => {
    expect(cardsFromResult(ok({ intent: "improve_prompt", suggestions: ["better idea", "ignored"] }))).toEqual([
      { kind: "improved_prompt", text: "better idea" }
    ]);
    expect(cardsFromResult(ok({ intent: "style_directions", suggestions: ["a", "b", "c", "d"] }))).toEqual([
      { kind: "styles", options: ["a", "b", "c"] }
    ]);
    // Suggestions without a matching intent never render.
    expect(cardsFromResult(ok({ intent: "none", suggestions: ["x"] }))).toEqual([]);
  });

  it("keeps the 3D card blocked: it carries no action and the chat cannot generate", () => {
    const cards = cardsFromResult(ok({ intent: "suggest_3d" }));
    expect(cards).toEqual([{ kind: "figurine" }]);
    expect(CHAT_GENERATION_ENABLED).toBe(false);
  });
});

describe("input helpers", () => {
  it("validates length", () => {
    expect(validateChatInput("hi")).toBe("ok");
    expect(validateChatInput("x".repeat(240))).toBe("ok");
    expect(validateChatInput("x".repeat(241))).toBe("too_long");
    expect(validateChatInput(" ")).toBe("empty");
  });

  it("sends on Enter, not on Shift+Enter or during IME composition", () => {
    expect(isSendKey({ key: "Enter", shiftKey: false })).toBe(true);
    expect(isSendKey({ key: "Enter", shiftKey: true })).toBe(false);
    expect(isSendKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
    expect(isSendKey({ key: "a", shiftKey: false })).toBe(false);
  });

  it("treats auth, flag and parent-consent errors as terminal", () => {
    expect(isTerminalChatError("flag_off")).toBe(true);
    expect(isTerminalChatError("auth")).toBe(true);
    expect(isTerminalChatError("consent_parent")).toBe(true);
    expect(isTerminalChatError("network")).toBe(false);
    expect(isTerminalChatError("rate_limited")).toBe(false);
  });
});

describe("history is session memory only", () => {
  const files = [
    "creation-chat-state.ts",
    "creation-chat.tsx",
    "creation-chat-cards.tsx",
    "assistant-client.ts",
    "right-panel-tabs.tsx"
  ].map((file) => readFileSync(join(__dirname, file), "utf8"));

  it("never touches browser storage, cookies or caches", () => {
    const source = files.join("\n");
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|caches\.|IDBFactory/);
  });

  it("never sends images, urls or storage paths to the assistant", () => {
    const client = readFileSync(join(__dirname, "assistant-client.ts"), "utf8");
    const bodyLine = client.split("\n").filter((line) => line.includes("JSON.stringify({ prompt"));
    expect(bodyLine).toHaveLength(1);
    expect(bodyLine[0]).toContain("prompt, locale, history");
    const chat = readFileSync(join(__dirname, "creation-chat.tsx"), "utf8");
    // The drawing is only ever an <img> thumbnail; it is not passed to the request helper.
    expect(chat).toMatch(/requestStudioAssistant/);
    expect(chat).not.toMatch(/requestStudioAssistant\([^)]*drawingSrc/);
    expect(chat).not.toMatch(/FormData|new Blob|readAsDataURL|toDataURL/);
  });
});
