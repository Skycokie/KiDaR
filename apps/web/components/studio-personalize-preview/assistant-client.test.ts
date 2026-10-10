import { describe, expect, it, vi } from "vitest";
import { assistantPath, requestStudioAssistant } from "./assistant-client";

describe("assistant-client", () => {
  it("encodes the project id in the path", () => {
    expect(assistantPath("abc 1")).toBe("/api/projects/abc%201/assistant");
  });

  it("maps flag_off and consent codes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 403,
        ok: false,
        json: async () => ({ code: "flag_off", error: "ai_disabled" })
      })
      .mockResolvedValueOnce({
        status: 403,
        ok: false,
        json: async () => ({ code: "ai", error: "consent_required" })
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toEqual({
      ok: false,
      error: "flag_off"
    });
    await expect(requestStudioAssistant("p1", "hi", "en")).resolves.toEqual({
      ok: false,
      error: "consent_ai"
    });
    vi.unstubAllGlobals();
  });

  it("parses a successful assistant reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          source: "ai",
          reply: "Nice swim!",
          intent: "suggest_3d",
          settings: { motion: "float", decor: "stars", palette: null, lighting: null }
        })
      })
    );
    await expect(requestStudioAssistant("p1", "swim", "en")).resolves.toMatchObject({
      ok: true,
      source: "ai",
      intent: "suggest_3d",
      settings: { motion: "float", decor: "stars" }
    });
    vi.unstubAllGlobals();
  });
});
