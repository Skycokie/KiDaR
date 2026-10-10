/**
 * Client helpers for Studio AI assistant. Kept out of the shell so fetch stays off shell source.
 */

export type AssistantClientSettings = {
  motion: string | null;
  decor: string | null;
  palette: string | null;
  lighting: string | null;
};

export type AssistantClientResult =
  | {
      ok: true;
      source: "ai" | "local" | "blocked";
      reply: string;
      intent: "none" | "suggest_3d";
      settings: AssistantClientSettings;
    }
  | {
      ok: false;
      error:
        | "auth"
        | "flag_off"
        | "consent_parent"
        | "consent_ai"
        | "rate_limited"
        | "store"
        | "network"
        | "generic";
    };

export function assistantPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/assistant`;
}

export async function requestStudioAssistant(
  projectId: string,
  prompt: string,
  locale: "ro" | "en"
): Promise<AssistantClientResult> {
  try {
    const response = await fetch(assistantPath(projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, locale })
    });
    if (response.status === 401) return { ok: false, error: "auth" };
    if (response.status === 403) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      if (payload?.code === "flag_off" || payload?.error === "ai_disabled") {
        return { ok: false, error: "flag_off" };
      }
      if (payload?.code === "parent") return { ok: false, error: "consent_parent" };
      if (payload?.code === "ai") return { ok: false, error: "consent_ai" };
      return { ok: false, error: "generic" };
    }
    if (response.status === 429) return { ok: false, error: "rate_limited" };
    if (response.status === 503) return { ok: false, error: "store" };
    if (!response.ok) return { ok: false, error: "generic" };
    const payload = (await response.json()) as {
      source?: "ai" | "local" | "blocked";
      reply?: string;
      intent?: "none" | "suggest_3d";
      settings?: AssistantClientSettings;
    };
    return {
      ok: true,
      source: payload.source ?? "local",
      reply: payload.reply ?? "",
      intent: payload.intent ?? "none",
      settings: {
        motion: payload.settings?.motion ?? null,
        decor: payload.settings?.decor ?? null,
        palette: payload.settings?.palette ?? null,
        lighting: payload.settings?.lighting ?? null
      }
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
