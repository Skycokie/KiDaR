/**
 * Whitelist schema for Studio AI assistant replies.
 * Model output is accepted only when every field is in these fixed lists.
 * Nothing in a reply is ever executed: the client maps known intents to fixed UI actions.
 */

import type { AnimationId, DecorId, LightingId, PaletteId } from "@/components/studio-personalize-preview/fixtures";

export const ASSISTANT_MOTIONS = ["wave", "float", "dance", "jump", "still", "follow"] as const satisfies readonly AnimationId[];
export const ASSISTANT_DECORS = ["stars", "grass", "tree", "house", "balloons"] as const satisfies readonly DecorId[];
export const ASSISTANT_PALETTES = ["original", "bright", "soft"] as const satisfies readonly PaletteId[];
export const ASSISTANT_LIGHTINGS = ["warm", "studio"] as const satisfies readonly LightingId[];
/**
 * `suggest_3d` only points at the (separate, confirmed) 3D flow.
 * `improve_prompt` / `style_directions` carry plain-text `suggestions`; they never start a job.
 */
export const ASSISTANT_INTENTS = ["none", "suggest_3d", "improve_prompt", "style_directions"] as const;
/** Intents that are allowed to carry `suggestions`. */
const SUGGESTION_INTENTS: readonly string[] = ["improve_prompt", "style_directions"];

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export type AssistantSettings = {
  motion?: AnimationId;
  decor?: DecorId;
  palette?: PaletteId;
  lighting?: LightingId;
};

export type AssistantReply = AssistantSettings & {
  reply: string;
  intent: AssistantIntent;
  /** Plain-text ideas (improved prompt or style directions). Rendered as text only. */
  suggestions?: string[];
};

export const ASSISTANT_REPLY_MAX = 280;
export const ASSISTANT_PROMPT_MAX = 240;
export const ASSISTANT_SUGGESTIONS_MAX = 3;
export const ASSISTANT_SUGGESTION_MAX = 120;
/** Past turns accepted from the client. In-memory only; the server never stores them. */
export const ASSISTANT_HISTORY_MAX = 6;
export const ASSISTANT_HISTORY_MESSAGE_MAX = ASSISTANT_REPLY_MAX;
/** Whole request body cap (bytes of text) before JSON parsing. */
export const ASSISTANT_BODY_MAX = 16_000;

export type AssistantHistoryMessage = { role: "user" | "assistant"; content: string };

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * Removes links so a URL (ours or typed/hallucinated) never travels to the model
 * and never comes back into the UI as a clickable-looking instruction.
 */
export function stripLinks(text: string): string {
  return text
    .replace(/\b(?:https?|ftp|wss?|file):\/\/[^\s"'<>]*/gi, "")
    .replace(/\b(?:data|blob):[^\s"'<>]+/gi, "")
    .replace(/\bwww\.[^\s"'<>]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return stripLinks(raw.replace(/\u0000/g, "")).slice(0, max);
}

function cleanReply(raw: unknown): string {
  return cleanText(raw, ASSISTANT_REPLY_MAX);
}

function cleanSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const text = cleanText(item, ASSISTANT_SUGGESTION_MAX);
    if (text) out.push(text);
    if (out.length >= ASSISTANT_SUGGESTIONS_MAX) break;
  }
  return out;
}

/**
 * Validates and narrows untrusted model JSON. Returns null when the payload is unusable.
 * Missing optional settings are allowed; invalid ones are dropped.
 */
export function parseAssistantReply(raw: unknown): AssistantReply | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const reply = cleanReply(body.reply);
  const intent = isOneOf(body.intent, ASSISTANT_INTENTS) ? body.intent : "none";

  const out: AssistantReply = { reply, intent };
  if (isOneOf(body.motion, ASSISTANT_MOTIONS)) out.motion = body.motion;
  if (isOneOf(body.decor, ASSISTANT_DECORS)) out.decor = body.decor;
  if (isOneOf(body.palette, ASSISTANT_PALETTES)) out.palette = body.palette;
  if (isOneOf(body.lighting, ASSISTANT_LIGHTINGS)) out.lighting = body.lighting;

  if (SUGGESTION_INTENTS.includes(intent)) {
    const suggestions = cleanSuggestions(body.suggestions);
    if (suggestions.length > 0) out.suggestions = suggestions;
  }

  // A reply with neither text nor any setting/suggestion is useless.
  if (
    !out.reply &&
    !out.motion &&
    !out.decor &&
    !out.palette &&
    !out.lighting &&
    !out.suggestions &&
    out.intent === "none"
  ) {
    return null;
  }
  return out;
}

export function limitAssistantPrompt(input: string): string {
  return input.replace(/\u0000/g, "").slice(0, ASSISTANT_PROMPT_MAX);
}

export type HistoryParse = { ok: true; history: AssistantHistoryMessage[] } | { ok: false };

/**
 * Validates the optional client-supplied conversation. Strict on purpose: any malformed
 * entry rejects the whole request instead of being silently repaired.
 * Content is link-stripped; only role + text are kept (no ids, urls, paths or extra keys).
 */
export function parseAssistantHistory(raw: unknown): HistoryParse {
  if (raw === undefined || raw === null) return { ok: true, history: [] };
  if (!Array.isArray(raw) || raw.length > ASSISTANT_HISTORY_MAX) return { ok: false };
  const history: AssistantHistoryMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false };
    const entry = item as Record<string, unknown>;
    if (entry.role !== "user" && entry.role !== "assistant") return { ok: false };
    if (typeof entry.content !== "string") return { ok: false };
    if (entry.content.length > ASSISTANT_HISTORY_MESSAGE_MAX) return { ok: false };
    const content = cleanText(entry.content, ASSISTANT_HISTORY_MESSAGE_MAX);
    if (!content) return { ok: false };
    history.push({ role: entry.role, content });
  }
  return { ok: true, history };
}
