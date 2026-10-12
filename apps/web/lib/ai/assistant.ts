/**
 * Orchestrates the Studio AI assistant: moderate → LLM → whitelist.
 *
 * Fail-closed by design:
 * - moderation unavailable or ambiguous → the model is never called;
 * - provider unavailable or unusable output → an explicit error, never a local imitation
 *   of an AI answer and never a fallback that forwards the text anywhere else.
 */

import { moderateText, type ModerationDeps } from "./moderation";
import { createOpenAiStudioProvider, type ChatLocale, type StudioAiProvider } from "./provider";
import {
  limitAssistantPrompt,
  type AssistantHistoryMessage,
  type AssistantReply
} from "./schema";

export type RunAssistantResult =
  | { ok: true; source: "ai"; reply: AssistantReply }
  | { ok: true; source: "blocked"; reply: AssistantReply }
  | { ok: false; error: "moderation_unavailable" | "provider_unavailable" };

export type RunAssistantDeps = {
  provider?: StudioAiProvider;
  moderation?: ModerationDeps;
};

const BLOCKED_REPLY: AssistantReply = { reply: "", intent: "none" };

/** Everything that would reach the model is moderated together, history included. */
function moderationInput(prompt: string, history: readonly AssistantHistoryMessage[]): string {
  return [...history.map((turn) => turn.content), prompt].join("\n");
}

export async function runStudioAssistant(
  input: { prompt: string; locale: ChatLocale; history?: readonly AssistantHistoryMessage[] },
  deps: RunAssistantDeps = {}
): Promise<RunAssistantResult> {
  const prompt = limitAssistantPrompt(input.prompt);
  const locale = input.locale === "en" ? "en" : "ro";
  const history = input.history ?? [];

  const moderation = await moderateText(moderationInput(prompt, history), deps.moderation);
  if (!moderation.ok) {
    return { ok: false, error: "moderation_unavailable" };
  }
  if (moderation.flagged) {
    return { ok: true, source: "blocked", reply: BLOCKED_REPLY };
  }

  const provider = deps.provider ?? createOpenAiStudioProvider();
  let reply: AssistantReply | null = null;
  try {
    reply = await provider.complete({ prompt, locale, history });
  } catch {
    reply = null;
  }
  if (!reply) {
    return { ok: false, error: "provider_unavailable" };
  }
  return { ok: true, source: "ai", reply };
}
