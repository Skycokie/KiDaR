import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantPath, remainingMessages, requestStudioAssistant } from "./assistant-client";

const reply = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body
});

afterEach(() => vi.unstubAllGlobals());

describe("assistant-client", () => {
  it("encodes the project id in the path", () => {
    expect(assistantPath("abc 1")).toBe("/api/projects/abc%201/assistant");
  });

  it("maps flag_off and consent codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(403, { code: "flag_off", error: "ai_disabled" }))
        .mockResolvedValueOnce(reply(403, { code: "ai", error: "consent_required" }))
        .mockResolvedValueOnce(reply(403, { code: "parent", error: "consent_required" }))
    );
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toEqual({ ok: false, error: "flag_off" });
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toEqual({ ok: false, error: "consent_ai" });
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toEqual({
      ok: false,
      error: "consent_parent"
    });
  });

  it("maps the new fail-closed and validation errors to safe codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(503, { error: "moderation_unavailable" }))
        .mockResolvedValueOnce(reply(503, { error: "store_missing" }))
        .mockResolvedValueOnce(reply(502, { error: "provider_unavailable" }))
        .mockResolvedValueOnce(reply(429, { error: "rate_limited" }))
        .mockResolvedValueOnce(reply(400, { error: "prompt_too_long" }))
        .mockResolvedValueOnce(reply(400, { error: "prompt_required" }))
        .mockResolvedValueOnce(reply(413, { error: "payload_too_large" }))
        .mockResolvedValueOnce(reply(401, {}))
        .mockResolvedValueOnce(reply(500, { error: "raw sk-secret" }))
    );
    const codes = [];
    for (let i = 0; i < 9; i += 1) {
      const result = await requestStudioAssistant("p1", "hi", "en");
      codes.push(result.ok ? "ok" : result.error);
    }
    expect(codes).toEqual([
      "moderation",
      "store",
      "provider",
      "rate_limited",
      "too_long",
      "empty",
      "too_long",
      "auth",
      "generic"
    ]);
  });

  it("maps a network failure without leaking the raw error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sk-secret")));
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toEqual({ ok: false, error: "network" });
  });

  it("parses a successful assistant reply with suggestions and real usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply(200, {
          source: "ai",
          reply: "Nice swim!",
          intent: "style_directions",
          settings: { motion: "float", decor: "stars", palette: null, lighting: null },
          suggestions: ["soft toy", "paper craft", 5],
          usage: { hourCount: 3, dayCount: 7, hourLimit: 10, dayLimit: 30 }
        })
      )
    );
    await expect(requestStudioAssistant("p1", "swim", "en")).resolves.toEqual({
      ok: true,
      source: "ai",
      reply: "Nice swim!",
      intent: "style_directions",
      settings: { motion: "float", decor: "stars", palette: null, lighting: null },
      suggestions: ["soft toy", "paper craft"],
      usage: { hourCount: 3, dayCount: 7, hourLimit: 10, dayLimit: 30 }
    });
  });

  it("accepts the previous response shape (no suggestions, no limits)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply(200, {
          source: "ai",
          reply: "ok",
          intent: "suggest_3d",
          settings: { motion: "float", decor: null, palette: null, lighting: null },
          usage: { hourCount: 1, dayCount: 1 }
        })
      )
    );
    await expect(requestStudioAssistant("p1", "swim", "en")).resolves.toMatchObject({
      ok: true,
      intent: "suggest_3d",
      suggestions: [],
      usage: null
    });
  });

  it("sends text only: prompt, locale and history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { source: "ai", reply: "ok", intent: "none" }));
    vi.stubGlobal("fetch", fetchMock);
    await requestStudioAssistant("p1", "make it friendly", "ro", [
      { role: "user", content: "a dragon" },
      { role: "assistant", content: "nice" }
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/p1/assistant");
    expect(JSON.parse(init.body as string)).toEqual({
      prompt: "make it friendly",
      locale: "ro",
      history: [
        { role: "user", content: "a dragon" },
        { role: "assistant", content: "nice" }
      ]
    });
  });

  it("ignores unknown intents and source values from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(200, { source: "local", reply: "x", intent: "start_job" }))
    );
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toMatchObject({
      ok: true,
      source: "ai",
      intent: "none"
    });
  });
});

describe("remainingMessages", () => {
  it("is unknown until the API reported counters", () => {
    expect(remainingMessages(null)).toBeNull();
  });

  it("uses the tighter of the hourly and daily limits", () => {
    expect(remainingMessages({ hourCount: 3, dayCount: 7, hourLimit: 10, dayLimit: 30 })).toBe(7);
    expect(remainingMessages({ hourCount: 2, dayCount: 29, hourLimit: 10, dayLimit: 30 })).toBe(1);
    expect(remainingMessages({ hourCount: 10, dayCount: 10, hourLimit: 10, dayLimit: 30 })).toBe(0);
    expect(remainingMessages({ hourCount: 12, dayCount: 40, hourLimit: 10, dayLimit: 30 })).toBe(0);
  });
});
