/**
 * Whitelist schema for Studio AI assistant replies.
 * Model output is accepted only when every field is in these fixed lists.
 */

import type { AnimationId, DecorId, LightingId, PaletteId } from "@/components/studio-personalize-preview/fixtures";

export const ASSISTANT_MOTIONS = ["wave", "float", "dance", "jump", "still", "follow"] as const satisfies readonly AnimationId[];
export const ASSISTANT_DECORS = ["stars", "grass", "tree", "house", "balloons"] as const satisfies readonly DecorId[];
export const ASSISTANT_PALETTES = ["original", "bright", "soft"] as const satisfies readonly PaletteId[];
export const ASSISTANT_LIGHTINGS = ["warm", "studio"] as const satisfies readonly LightingId[];
export const ASSISTANT_INTENTS = ["none", "suggest_3d"] as const;

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
};

export const ASSISTANT_REPLY_MAX = 160;
export const ASSISTANT_PROMPT_MAX = 240;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function cleanReply(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, ASSISTANT_REPLY_MAX);
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

  // A reply with neither text nor any setting is useless.
  if (!out.reply && !out.motion && !out.decor && !out.palette && !out.lighting && out.intent === "none") {
    return null;
  }
  return out;
}

export function limitAssistantPrompt(input: string): string {
  return input.replace(/\u0000/g, "").slice(0, ASSISTANT_PROMPT_MAX);
}
