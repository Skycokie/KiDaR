/**
 * Pure logic for the Studio creation chat. No React, no storage.
 * The conversation lives only in component memory and is gone on refresh; nothing here
 * persists it, and nothing here ever includes an image, url or storage path.
 */

import {
  ASSISTANT_DECORS,
  ASSISTANT_HISTORY_MAX,
  ASSISTANT_LIGHTINGS,
  ASSISTANT_MOTIONS,
  ASSISTANT_PALETTES,
  ASSISTANT_PROMPT_MAX
} from "@/lib/ai/schema";
import type {
  AssistantClientError,
  AssistantClientHistoryMessage,
  AssistantClientResult,
  AssistantClientUsage
} from "./assistant-client";
import type { AnimationId, DecorId, LightingId, PaletteId } from "./fixtures";

export const CHAT_PROMPT_MAX = ASSISTANT_PROMPT_MAX;

export type ChatSettings = {
  motion: AnimationId | null;
  decor: DecorId | null;
  palette: PaletteId | null;
  lighting: LightingId | null;
};

/** The only things an assistant message can offer. Each maps to a fixed, known UI action. */
export type ChatCard =
  | { kind: "settings"; settings: ChatSettings }
  | { kind: "improved_prompt"; text: string }
  | { kind: "styles"; options: string[] }
  | { kind: "figurine" };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: ChatCard[];
  /** Turn that did not complete: kept on screen, never sent back to the model. */
  status?: "failed" | "blocked";
  error?: AssistantClientError;
};

export type ChatAvailability = "ready" | "no_project";

/** Without a project the chat is visible but inert: no composer, no fetch. */
export function chatAvailability(projectId: string | null | undefined): ChatAvailability {
  return projectId ? "ready" : "no_project";
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Turns an API result into cards. Values are re-checked against the fixed lists here too,
 * so a malformed payload can never apply an unknown setting.
 */
export function cardsFromResult(
  result: Extract<AssistantClientResult, { ok: true }>
): ChatCard[] {
  const cards: ChatCard[] = [];
  const settings: ChatSettings = {
    motion: oneOf(result.settings.motion, ASSISTANT_MOTIONS),
    decor: oneOf(result.settings.decor, ASSISTANT_DECORS),
    palette: oneOf(result.settings.palette, ASSISTANT_PALETTES),
    lighting: oneOf(result.settings.lighting, ASSISTANT_LIGHTINGS)
  };
  if (settings.motion || settings.decor || settings.palette || settings.lighting) {
    cards.push({ kind: "settings", settings });
  }
  if (result.intent === "improve_prompt" && result.suggestions[0]) {
    cards.push({ kind: "improved_prompt", text: result.suggestions[0] });
  }
  if (result.intent === "style_directions" && result.suggestions.length > 0) {
    cards.push({ kind: "styles", options: result.suggestions.slice(0, 3) });
  }
  if (result.intent === "suggest_3d") {
    cards.push({ kind: "figurine" });
  }
  return cards;
}

/**
 * History sent to the server: only completed turns, text only, last N.
 * Failed/blocked turns, cards, ids and settings never leave the page.
 */
export function buildHistory(messages: readonly ChatMessage[]): AssistantClientHistoryMessage[] {
  return messages
    .filter((message) => !message.status && message.text.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.text }))
    .slice(-ASSISTANT_HISTORY_MAX);
}

export function validateChatInput(text: string): "ok" | "empty" | "too_long" {
  if (!text.trim()) return "empty";
  if (text.length > CHAT_PROMPT_MAX) return "too_long";
  return "ok";
}

export type TurnOutcome =
  | { kind: "unavailable" }
  | { kind: "invalid"; reason: "empty" | "too_long" }
  | { kind: "ok"; reply: string; cards: ChatCard[]; usage: AssistantClientUsage | null }
  | { kind: "blocked"; usage: AssistantClientUsage | null }
  | { kind: "error"; error: AssistantClientError };

export type TurnRequest = (
  projectId: string,
  prompt: string,
  locale: "ro" | "en",
  history: AssistantClientHistoryMessage[]
) => Promise<AssistantClientResult>;

/**
 * One chat turn. Performs no request at all unless the chat is available and the text is valid.
 * Never starts a job: the only network call is the text assistant.
 */
export async function runChatTurn(input: {
  projectId: string | null | undefined;
  text: string;
  locale: "ro" | "en";
  messages: readonly ChatMessage[];
  request: TurnRequest;
}): Promise<TurnOutcome> {
  if (chatAvailability(input.projectId) !== "ready" || !input.projectId) {
    return { kind: "unavailable" };
  }
  const validity = validateChatInput(input.text);
  if (validity !== "ok") return { kind: "invalid", reason: validity };

  const result = await input.request(
    input.projectId,
    input.text.trim(),
    input.locale,
    buildHistory(input.messages)
  );
  if (!result.ok) return { kind: "error", error: result.error };
  if (result.source === "blocked") return { kind: "blocked", usage: result.usage };
  return { kind: "ok", reply: result.reply, cards: cardsFromResult(result), usage: result.usage };
}

/** Errors after which sending again can't help until something else changes. */
export function isTerminalChatError(error: AssistantClientError): boolean {
  return error === "flag_off" || error === "auth" || error === "consent_parent";
}

/** Enter sends; Shift+Enter inserts a newline; never while an IME composition is open. */
export function isSendKey(event: {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
}): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
