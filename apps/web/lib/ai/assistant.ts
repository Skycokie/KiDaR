/**
 * Orchestrates Studio AI assistant: moderate → LLM → whitelist, else local keyword fallback.
 */

import {
  interpretIdeaPrompt,
  type PromptLanguage
} from "@/components/studio-personalize-preview/idea-prompt";
import { moderateText, type ModerationDeps } from "./moderation";
import { createOpenAiStudioProvider, type ChatLocale, type StudioAiProvider } from "./provider";
import {
  limitAssistantPrompt,
  type AssistantIntent,
  type AssistantReply
} from "./schema";

export type AssistantSource = "ai" | "local" | "blocked";

export type RunAssistantResult = {
  source: AssistantSource;
  reply: AssistantReply;
};

export type RunAssistantDeps = {
  provider?: StudioAiProvider;
  moderation?: ModerationDeps;
  /** When moderation fails (network), fall back to local instead of blocking. */
  moderationFailOpen?: boolean;
};

function localAsReply(prompt: string, locale: PromptLanguage): AssistantReply {
  const idea = interpretIdeaPrompt(prompt, locale);
  return {
    reply: "",
    intent: "none",
    motion: idea.motion,
    decor: idea.decor,
    palette: idea.palette,
    lighting: idea.lighting
  };
}

function emptyReply(intent: AssistantIntent = "none"): AssistantReply {
  return { reply: "", intent };
}

export async function runStudioAssistant(
  input: { prompt: string; locale: ChatLocale },
  deps: RunAssistantDeps = {}
): Promise<RunAssistantResult> {
  const prompt = limitAssistantPrompt(input.prompt);
  const locale = input.locale === "en" ? "en" : "ro";

  if (!prompt.trim()) {
    return { source: "local", reply: emptyReply() };
  }

  const moderation = await moderateText(prompt, deps.moderation);
  if (moderation.ok && moderation.flagged) {
    return { source: "blocked", reply: emptyReply() };
  }
  if (!moderation.ok && deps.moderationFailOpen === false) {
    return { source: "blocked", reply: emptyReply() };
  }

  const provider = deps.provider ?? createOpenAiStudioProvider();
  const ai = await provider.complete({ prompt, locale });
  if (ai) {
    return { source: "ai", reply: ai };
  }

  return { source: "local", reply: localAsReply(prompt, locale) };
}
