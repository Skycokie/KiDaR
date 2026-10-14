/**
 * Studio AI chat provider. OpenAI Chat Completions with JSON object response.
 */

import {
  ASSISTANT_DECORS,
  ASSISTANT_INTENTS,
  ASSISTANT_LIGHTINGS,
  ASSISTANT_MOTIONS,
  ASSISTANT_PALETTES,
  parseAssistantReply,
  type AssistantReply
} from "./schema";
import { resolveAiChatApiKey, resolveAiChatModel } from "./feature";

export type ChatLocale = "ro" | "en";

export type StudioAiProvider = {
  complete(input: { prompt: string; locale: ChatLocale }): Promise<AssistantReply | null>;
};

export type OpenAiProviderDeps = {
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  model?: string;
  timeoutMs?: number;
};

function systemPrompt(locale: ChatLocale): string {
  const lang = locale === "en" ? "English" : "Romanian";
  return [
    "You help parents and children personalize a drawing-based AR character in kidAR Studio.",
    "Return ONLY a JSON object with keys: reply, motion, decor, palette, lighting, intent.",
    `reply: short friendly ${lang} sentence (max 160 chars). Never ask for personal data.`,
    `motion: one of ${ASSISTANT_MOTIONS.join(", ")} or omit.`,
    `decor: one of ${ASSISTANT_DECORS.join(", ")} or omit.`,
    `palette: one of ${ASSISTANT_PALETTES.join(", ")} or omit.`,
    `lighting: one of ${ASSISTANT_LIGHTINGS.join(", ")} or omit.`,
    `intent: ${ASSISTANT_INTENTS.join(" | ")}. Use suggest_3d only when the user clearly wants a 3D figure generated.`,
    "Map swimming/înot to float. Map following the camera to follow.",
    "Never invent other values. Keep content suitable for all ages. No violence, hate, or adult themes."
  ].join(" ");
}

export function createOpenAiStudioProvider(deps: OpenAiProviderDeps = {}): StudioAiProvider {
  const apiKey = deps.apiKey ?? resolveAiChatApiKey();
  const model = deps.model ?? resolveAiChatModel();
  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 12_000;

  return {
    async complete({ prompt, locale }) {
      if (!apiKey) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt(locale) },
              { role: "user", content: prompt }
            ]
          }),
          signal: controller.signal
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) return null;
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          return null;
        }
        return parseAssistantReply(parsed);
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
