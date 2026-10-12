import { describe, expect, it, vi } from "vitest";
import { runStudioAssistant } from "./assistant";
import { createOpenAiStudioProvider, type StudioAiProvider } from "./provider";

const okModeration = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [{ flagged: false, categories: {} }] })
  });

const moderation = (fetchImpl: ReturnType<typeof vi.fn>) => ({ apiKey: "test", fetchImpl });

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
      { provider, moderation: moderation(okModeration()) }
    );
    expect(result).toMatchObject({ ok: true, source: "ai", reply: { motion: "float", decor: "stars" } });
  });

  it("passes the history to the provider", async () => {
    const complete = vi.fn().mockResolvedValue({ reply: "ok", intent: "none" });
    const history = [
      { role: "user" as const, content: "a dragon" },
      { role: "assistant" as const, content: "nice" }
    ];
    await runStudioAssistant(
      { prompt: "make it friendly", locale: "en", history },
      { provider: { complete }, moderation: moderation(okModeration()) }
    );
    expect(complete).toHaveBeenCalledWith({ prompt: "make it friendly", locale: "en", history });
  });

  it("moderates the whole text that would reach the model, history included", async () => {
    const fetchImpl = okModeration();
    await runStudioAssistant(
      {
        prompt: "new message",
        locale: "en",
        history: [{ role: "user", content: "earlier message" }]
      },
      { provider: { complete: vi.fn().mockResolvedValue({ reply: "ok", intent: "none" }) }, moderation: moderation(fetchImpl) }
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string) as { input: string };
    expect(body.input).toContain("earlier message");
    expect(body.input).toContain("new message");
  });

  it("blocks when moderation flags the text and never calls the model", async () => {
    const provider: StudioAiProvider = { complete: vi.fn() };
    const result = await runStudioAssistant(
      { prompt: "bad content", locale: "en" },
      {
        provider,
        moderation: moderation(
          vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ results: [{ flagged: true, categories: { violence: true } }] })
          })
        )
      }
    );
    expect(result).toMatchObject({ ok: true, source: "blocked", reply: { reply: "", intent: "none" } });
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it.each([
    ["network error", vi.fn().mockRejectedValue(new Error("boom: sk-secret"))],
    ["provider 500", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })],
    ["no results", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })],
    [
      "ambiguous verdict",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ categories: {} }] }) })
    ]
  ])("fails closed on moderation %s: the model is never called", async (_name, fetchImpl) => {
    const provider: StudioAiProvider = { complete: vi.fn() };
    const result = await runStudioAssistant(
      { prompt: "hello", locale: "en" },
      { provider, moderation: moderation(fetchImpl) }
    );
    expect(result).toEqual({ ok: false, error: "moderation_unavailable" });
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("fails closed when the moderation key is missing", async () => {
    const provider: StudioAiProvider = { complete: vi.fn() };
    const fetchImpl = vi.fn();
    const result = await runStudioAssistant(
      { prompt: "hello", locale: "en" },
      { provider, moderation: { apiKey: "", fetchImpl } }
    );
    expect(result).toEqual({ ok: false, error: "moderation_unavailable" });
    expect(provider.complete).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports an explicit provider error instead of imitating an AI answer", async () => {
    const provider: StudioAiProvider = { complete: vi.fn().mockResolvedValue(null) };
    const result = await runStudioAssistant(
      { prompt: "float among the stars", locale: "en" },
      { provider, moderation: moderation(okModeration()) }
    );
    expect(result).toEqual({ ok: false, error: "provider_unavailable" });
  });

  it("treats a throwing provider as unavailable", async () => {
    const provider: StudioAiProvider = {
      complete: vi.fn().mockRejectedValue(new Error("raw provider failure sk-secret"))
    };
    const result = await runStudioAssistant(
      { prompt: "hello", locale: "en" },
      { provider, moderation: moderation(okModeration()) }
    );
    expect(result).toEqual({ ok: false, error: "provider_unavailable" });
    expect(JSON.stringify(result)).not.toContain("sk-secret");
  });
});

describe("OpenAI provider request (mocked fetch)", () => {
  const completion = (content: unknown) =>
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] })
    });

  it("sends only system prompt, text history and the new message", async () => {
    const fetchImpl = completion({ reply: "ok", intent: "none", motion: "wave" });
    const provider = createOpenAiStudioProvider({ fetchImpl, apiKey: "test-key", model: "m" });
    await provider.complete({
      prompt: "make it friendly",
      locale: "en",
      history: [
        { role: "user", content: "a dragon" },
        { role: "assistant", content: "nice one" }
      ]
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    // Every content is a plain string: no image parts, no url fields.
    expect(body.messages.every((m) => typeof m.content === "string")).toBe(true);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/image_url|input_image|data:image|https?:\/\/(?!api\.openai)/i);
    expect(serialized).not.toMatch(/source_image|storage|signed|token|api\/files/i);
    expect(body.messages[0].content as string).toMatch(/CANNOT see the drawing/);
  });

  it("returns null (never throws) on http errors and unusable output", async () => {
    const down = createOpenAiStudioProvider({
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      apiKey: "test-key"
    });
    await expect(down.complete({ prompt: "hi", locale: "ro" })).resolves.toBeNull();

    const garbage = createOpenAiStudioProvider({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "not json" } }] })
      }),
      apiKey: "test-key"
    });
    await expect(garbage.complete({ prompt: "hi", locale: "ro" })).resolves.toBeNull();

    const throwing = createOpenAiStudioProvider({
      fetchImpl: vi.fn().mockRejectedValue(new Error("network sk-secret")),
      apiKey: "test-key"
    });
    await expect(throwing.complete({ prompt: "hi", locale: "ro" })).resolves.toBeNull();

    const noKey = createOpenAiStudioProvider({ fetchImpl: vi.fn(), apiKey: null });
    await expect(noKey.complete({ prompt: "hi", locale: "ro" })).resolves.toBeNull();
  });

  it("drops non-whitelisted model output", async () => {
    const provider = createOpenAiStudioProvider({
      fetchImpl: completion({
        reply: "ok",
        intent: "start_job",
        motion: "teleport",
        decor: "volcano",
        action: "publish"
      }),
      apiKey: "test-key"
    });
    await expect(provider.complete({ prompt: "hi", locale: "en" })).resolves.toEqual({
      reply: "ok",
      intent: "none"
    });
  });
});
