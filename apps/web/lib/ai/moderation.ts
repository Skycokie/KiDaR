/**
 * OpenAI Moderation API wrapper. Free endpoint; fail closed on network/config errors
 * when callers opt in via `failClosed`.
 */

export type ModerationResult =
  | { ok: true; flagged: false }
  | { ok: true; flagged: true; categories: string[] }
  | { ok: false; error: "missing_key" | "network" | "provider" };

export type ModerationDeps = {
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  timeoutMs?: number;
};

export async function moderateText(
  text: string,
  deps: ModerationDeps = {}
): Promise<ModerationResult> {
  const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.AI_CHAT_API_KEY;
  if (!apiKey?.trim()) return { ok: false, error: "missing_key" };

  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey.trim()}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text
      }),
      signal: controller.signal
    });
    if (!response.ok) return { ok: false, error: "provider" };
    const payload = (await response.json()) as {
      results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>;
    };
    const first = payload.results?.[0];
    if (!first) return { ok: false, error: "provider" };
    if (!first.flagged) return { ok: true, flagged: false };
    const categories = Object.entries(first.categories ?? {})
      .filter(([, on]) => on)
      .map(([name]) => name);
    return { ok: true, flagged: true, categories };
  } catch {
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}
