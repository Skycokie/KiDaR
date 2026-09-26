/**
 * Local-only scene Context for Studio.
 * Deterministic Romanian story → preview choices. No network, no model, no generation.
 *
 * Context can later be the place a full prompt is sent server-side after validation,
 * quality review, and publish eligibility. Not implemented here.
 */

import {
  ANIMATIONS,
  DECOR_ASSETS,
  type AnimationId,
  type DecorId,
  type LightingId,
  type PaletteId
} from "./fixtures";
import { interpretIdeaPrompt } from "./idea-prompt";

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

export const CONTEXT_SUGGESTIONS = [
  "Într-o grădină magică",
  "Printre stele",
  "Într-o pădure liniștită",
  "La o casă colorată",
  "Într-o lume cu baloane"
] as const;

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

const DIACRITICS: Record<string, string> = {
  ă: "a",
  â: "a",
  î: "i",
  ș: "s",
  ş: "s",
  ț: "t",
  ţ: "t",
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u"
};

/** Same normalize rules as the idea prompt, without the 240-char idea cap. */
function normalizeForMatch(input: string): string {
  const collapsed = trimContextStory(input).toLowerCase();
  let out = "";
  for (const char of collapsed) {
    out += DIACRITICS[char] ?? char;
  }
  return out;
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

const LOCATION_RULES: PhraseRule[] = [
  { value: "într-o grădină", phrases: ["gradina", "iarba"] },
  { value: "printre stele", phrases: ["stele", "stea", "spatiu", "cosmos"] },
  { value: "într-o pădure", phrases: ["padure", "copac"] },
  { value: "la o casă", phrases: ["casa"] },
  { value: "într-o lume cu baloane", phrases: ["baloane", "balon"] },
  { value: "sub un nor", phrases: ["nori", "nor"] },
  { value: "lângă o planetă", phrases: ["planeta", "luna"] }
];

const ACTION_RULES: PhraseRule[] = [
  { value: "plutește", phrases: ["pluteste", "pluteasca", "zboara", "in aer"] },
  { value: "salută", phrases: ["saluta", "face cu mana"] },
  { value: "dansează", phrases: ["danseaza", "danseze"] },
  { value: "sare", phrases: ["sare", "sara", "salta"] },
  { value: "stă liniștit", phrases: ["sta linistit", "linistit", "sta"] }
];

const MOOD_RULES: PhraseRule[] = [
  { value: "magică", phrases: ["magica", "magic", "fermecat", "fermecata"] },
  { value: "liniștită", phrases: ["linistita", "linistit"] },
  { value: "colorată", phrases: ["colorata", "colorat", "vesel", "stralucitoare"] }
];

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
export function parseSceneContext(input: string): SceneContextParse {
  const story = trimContextStory(input);
  const normalized = normalizeForMatch(story);
  const idea = interpretIdeaPrompt(story);

  const location = pickLast(normalized, LOCATION_RULES);
  let action = pickLast(normalized, ACTION_RULES);
  const mood = pickLast(normalized, MOOD_RULES);
  const dialogue = extractDialogue(story);

  // Prefer explicit action phrases; fall back to motion label when only the interpreter matched.
  if (!action && idea.motion) {
    action = ANIMATIONS.find((item) => item.id === idea.motion)?.label.toLowerCase() ?? "";
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

function labelOf(options: { id: string; label: string }[], id: string): string {
  return options.find((item) => item.id === id)?.label ?? id;
}

/** Readable local-preview summary for the Context panel. Plain text only. */
export function contextPreviewLines(
  context: SceneContext,
  state: { animation: AnimationId; decor: { id: DecorId }[] }
): string[] {
  const lines: string[] = [];
  const action = context.action || labelOf(ANIMATIONS, state.animation).toLowerCase();
  const location =
    context.location ||
    (state.decor[0] ? labelOf(DECOR_ASSETS, state.decor[0].id).toLowerCase() : "");

  if (action && location) {
    lines.push(`Personajul tău ${action} ${location}.`);
  } else if (action) {
    lines.push(`Personajul tău ${action}.`);
  } else if (location) {
    lines.push(`Personajul tău este ${location}.`);
  } else if (context.story) {
    lines.push(context.story);
  }

  if (context.mood) lines.push(`Atmosferă: ${context.mood}.`);
  if (context.dialogue) lines.push(`Spune: «${context.dialogue}».`);
  lines.push(`Mișcare: ${labelOf(ANIMATIONS, state.animation)}.`);
  lines.push(
    `Decor: ${
      state.decor.length > 0
        ? state.decor.map((item) => labelOf(DECOR_ASSETS, item.id)).join(", ")
        : "Fără decor"
    }.`
  );
  lines.push("Previzualizare locală — nu este o scenă 3D generată.");
  return lines;
}
