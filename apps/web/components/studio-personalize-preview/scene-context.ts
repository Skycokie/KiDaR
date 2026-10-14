/**
 * Local-only scene Context for Studio.
 * Deterministic story → preview choices. No network, no model, no generation.
 *
 * Context can later be the place a full prompt is sent server-side after validation,
 * quality review, and publish eligibility. Not implemented here.
 */

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import type { AnimationId, DecorId, LightingId, PaletteId } from "./fixtures";
import { foldDiacritics, interpretIdeaPrompt } from "./idea-prompt";

export const CONTEXT_STORY_MAX = 500;
export const CONTEXT_DIALOGUE_MAX = 80;

export type SceneContext = {
  location: string;
  action: string;
  mood: string;
  dialogue: string;
  story: string;
  previewOnly: true;
};

export type SceneContextParse = {
  context: SceneContext;
  /** Studio categories recognized via the shared idea interpreter. */
  motion?: AnimationId;
  decor?: DecorId;
  palette?: PaletteId;
  lighting?: LightingId;
  recognizedStudio: boolean;
};

export function contextSuggestions(locale: Locale = "ro") {
  return getMessages(locale).personalize.contextSuggestions;
}

export function emptySceneContext(): SceneContext {
  return {
    location: "",
    action: "",
    mood: "",
    dialogue: "",
    story: "",
    previewOnly: true
  };
}

/** Plain text only — strip nulls and cap length. Never interpret HTML. */
export function limitContextStory(input: string): string {
  return String(input ?? "")
    .replace(/\u0000/g, "")
    .slice(0, CONTEXT_STORY_MAX);
}

export function trimContextStory(input: string): string {
  return limitContextStory(input).replace(/\s+/g, " ").trim();
}

function normalizeForMatch(input: string): string {
  return foldDiacritics(trimContextStory(input).toLowerCase());
}

type PhraseRule = { value: string; phrases: string[] };

function lastPhraseEnd(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "g");
  let end = -1;
  for (const match of text.matchAll(pattern)) {
    end = match.index + match[0].length;
  }
  return end;
}

function pickLast(text: string, rules: PhraseRule[]): string {
  let best: { end: number; value: string } | null = null;
  for (const rule of rules) {
    for (const phrase of rule.phrases) {
      const end = lastPhraseEnd(text, phrase);
      if (end < 0) continue;
      if (!best || end >= best.end) best = { end, value: rule.value };
    }
  }
  return best?.value ?? "";
}

function locationRules(locale: Locale): PhraseRule[] {
  const loc = getMessages(locale).personalize.contextFields.location;
  return [
    { value: loc.garden, phrases: ["gradina", "iarba"] },
    { value: loc.stars, phrases: ["stele", "stea", "spatiu", "cosmos"] },
    { value: loc.forest, phrases: ["padure", "copac"] },
    { value: loc.house, phrases: ["casa"] },
    { value: loc.balloons, phrases: ["baloane", "balon"] },
    { value: loc.cloud, phrases: ["nori", "nor"] },
    { value: loc.planet, phrases: ["planeta", "luna"] }
  ];
}

function actionRules(locale: Locale): PhraseRule[] {
  const action = getMessages(locale).personalize.contextFields.action;
  return [
    { value: action.float, phrases: ["pluteste", "pluteasca", "zboara", "in aer"] },
    { value: action.wave, phrases: ["saluta", "face cu mana"] },
    { value: action.dance, phrases: ["danseaza", "danseze"] },
    { value: action.jump, phrases: ["sare", "sara", "salta"] },
    { value: action.still, phrases: ["sta linistit", "linistit", "sta"] }
  ];
}

function moodRules(locale: Locale): PhraseRule[] {
  const mood = getMessages(locale).personalize.contextFields.mood;
  return [
    { value: mood.magic, phrases: ["magica", "magic", "fermecat", "fermecata"] },
    { value: mood.calm, phrases: ["linistita", "linistit"] },
    { value: mood.colorful, phrases: ["colorata", "colorat", "vesel", "stralucitoare"] }
  ];
}

function extractDialogue(raw: string): string {
  const patterns = [/«([^»]+)»/u, /„([^”]+)”/u, /"([^"]+)"/u, /'([^']+)'/u];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match?.[1]) continue;
    const plain = match[1].replace(/\s+/g, " ").trim().slice(0, CONTEXT_DIALOGUE_MAX);
    if (plain) return plain;
  }
  return "";
}

/**
 * Derive SceneContext narrative fields and reuse the idea interpreter for
 * motion / decor / palette / lighting. Unrecognized categories stay unset.
 */
export function parseSceneContext(input: string, locale: Locale = "ro"): SceneContextParse {
  const story = trimContextStory(input);
  const normalized = normalizeForMatch(story);
  const idea = interpretIdeaPrompt(story, locale);
  const COPY = getMessages(locale).personalize;

  const location = pickLast(normalized, locationRules(locale));
  let action = pickLast(normalized, actionRules(locale));
  const mood = pickLast(normalized, moodRules(locale));
  const dialogue = extractDialogue(story);

  if (!action && idea.motion) {
    action = COPY.choices.animations[idea.motion].label.toLowerCase();
  }

  return {
    context: {
      location,
      action,
      mood,
      dialogue,
      story,
      previewOnly: true
    },
    motion: idea.motion,
    decor: idea.decor,
    palette: idea.palette,
    lighting: idea.lighting,
    recognizedStudio: idea.recognized
  };
}

/** Readable local-preview summary for the Context panel. Plain text only. */
export function contextPreviewLines(
  context: SceneContext,
  state: { animation: AnimationId; decor: { id: DecorId }[] },
  locale: Locale = "ro"
): string[] {
  const COPY = getMessages(locale).personalize;
  const preview = COPY.contextPreview;
  const lines: string[] = [];
  const action = context.action || COPY.choices.animations[state.animation].label.toLowerCase();
  const location =
    context.location || (state.decor[0] ? COPY.choices.decor[state.decor[0].id].label.toLowerCase() : "");

  if (action && location) {
    lines.push(preview.actionLocation.replace("{action}", action).replace("{location}", location));
  } else if (action) {
    lines.push(preview.actionOnly.replace("{action}", action));
  } else if (location) {
    lines.push(preview.locationOnly.replace("{location}", location));
  } else if (context.story) {
    lines.push(context.story);
  }

  if (context.mood) lines.push(preview.mood.replace("{mood}", context.mood));
  if (context.dialogue) lines.push(preview.dialogue.replace("{dialogue}", context.dialogue));
  lines.push(preview.motion.replace("{label}", COPY.choices.animations[state.animation].label));
  lines.push(
    preview.decor.replace(
      "{label}",
      state.decor.length > 0
        ? state.decor.map((item) => COPY.choices.decor[item.id].label).join(", ")
        : COPY.noDecor
    )
  );
  lines.push(preview.localNote);
  return lines;
}
