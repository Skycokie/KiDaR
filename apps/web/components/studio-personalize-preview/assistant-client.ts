/**
 * Client helpers for Studio AI assistant. Kept out of the shell so fetch stays off shell source.
 * Text only: the request body is { prompt, locale, history }. No image, url or storage path.
 */

export type AssistantClientSettings = {
  motion: string | null;
  decor: string | null;
  palette: string | null;
  lighting: string | null;
};

export type AssistantClientIntent = "none" | "suggest_3d" | "improve_prompt" | "style_directions";

export type AssistantClientUsage = {
  hourCount: number;
  dayCount: number;
  hourLimit: number;
  dayLimit: number;
};

export type AssistantClientHistoryMessage = { role: "user" | "assistant"; content: string };

export type AssistantClientError =
  | "auth"
  | "flag_off"
  | "consent_parent"
  | "consent_ai"
  | "rate_limited"
  | "store"
  | "moderation"
  | "provider"
  | "empty"
  | "too_long"
  | "network"
  | "generic";

export type AssistantClientResult =
  | {
      ok: true;
      source: "ai" | "blocked";
      reply: string;
      intent: AssistantClientIntent;
      settings: AssistantClientSettings;
      suggestions: string[];
      /** Real counters from the API; null when the server did not send them. */
      usage: AssistantClientUsage | null;
    }
  | { ok: false; error: AssistantClientError };

const INTENTS: readonly AssistantClientIntent[] = ["none", "suggest_3d", "improve_prompt", "style_directions"];

export function assistantPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/assistant`;
}

function readUsage(raw: unknown): AssistantClientUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  const numbers = [usage.hourCount, usage.dayCount, usage.hourLimit, usage.dayLimit];
  if (!numbers.every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return {
    hourCount: usage.hourCount as number,
    dayCount: usage.dayCount as number,
    hourLimit: usage.hourLimit as number,
    dayLimit: usage.dayLimit as number
  };
}

/** Messages left right now, from the real counters. Null until the API reported them. */
export function remainingMessages(usage: AssistantClientUsage | null): number | null {
  if (!usage) return null;
  return Math.max(0, Math.min(usage.hourLimit - usage.hourCount, usage.dayLimit - usage.dayCount));
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export async function requestStudioAssistant(
  projectId: string,
  prompt: string,
  locale: "ro" | "en",
  history: readonly AssistantClientHistoryMessage[] = []
): Promise<AssistantClientResult> {
  try {
    const response = await fetch(assistantPath(projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, locale, history })
    });
    if (response.status === 401) return { ok: false, error: "auth" };
    if (response.status === 403) {
      const payload = await readBody(response);
      if (payload.code === "flag_off" || payload.error === "ai_disabled") {
        return { ok: false, error: "flag_off" };
      }
      if (payload.code === "parent") return { ok: false, error: "consent_parent" };
      if (payload.code === "ai") return { ok: false, error: "consent_ai" };
      return { ok: false, error: "generic" };
    }
    if (response.status === 400) {
      const payload = await readBody(response);
      if (payload.error === "prompt_required") return { ok: false, error: "empty" };
      if (payload.error === "prompt_too_long") return { ok: false, error: "too_long" };
      return { ok: false, error: "generic" };
    }
    if (response.status === 413) return { ok: false, error: "too_long" };
    if (response.status === 429) return { ok: false, error: "rate_limited" };
    if (response.status === 502) return { ok: false, error: "provider" };
    if (response.status === 503) {
      const payload = await readBody(response);
      return { ok: false, error: payload.error === "moderation_unavailable" ? "moderation" : "store" };
    }
    if (!response.ok) return { ok: false, error: "generic" };

    const payload = await readBody(response);
    const settings = (payload.settings && typeof payload.settings === "object"
      ? payload.settings
      : {}) as Record<string, unknown>;
    const asString = (value: unknown) => (typeof value === "string" ? value : null);
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [];
    return {
      ok: true,
      source: payload.source === "blocked" ? "blocked" : "ai",
      reply: typeof payload.reply === "string" ? payload.reply : "",
      intent: INTENTS.includes(payload.intent as AssistantClientIntent)
        ? (payload.intent as AssistantClientIntent)
        : "none",
      settings: {
        motion: asString(settings.motion),
        decor: asString(settings.decor),
        palette: asString(settings.palette),
        lighting: asString(settings.lighting)
      },
      suggestions,
      usage: readUsage(payload.usage)
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function recordAiConsent(): Promise<boolean> {
  try {
    const response = await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "ai" })
    });
    return response.ok;
  } catch {
    return false;
  }
}
