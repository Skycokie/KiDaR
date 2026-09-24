/**
 * Deterministic local prompt interpreter. No network, no model, no generation.
 * Recognized words update preview choices. Unrecognized text leaves them alone.
 */

import {
  ANIMATIONS,
  DECOR_ASSETS,
  type AnimationId,
  type DecorId,
  type LightingId,
  type PaletteId
} from "./fixtures";

export const IDEA_PROMPT_MAX = 240;

export type IdeaPromptResult = {
  recognized: boolean;
  text: string;
  motion?: AnimationId;
  decor?: DecorId;
  palette?: PaletteId;
  lighting?: LightingId;
  lines: string[];
};

export const IDEA_SUGGESTIONS = [
  "Să plutească printre stele",
  "Să danseze într-o grădină",
  "Să sară lângă o casă colorată",
  "Să fie liniștit sub un nor",
  "Să fie într-o lume cu baloane"
] as const;

const PALETTE_LINE: Record<PaletteId, string> = {
  original: "Original",
  bright: "Vii",
  soft: "Moi"
};

const LIGHTING_LINE: Record<LightingId, string> = {
  warm: "Caldă",
  studio: "Studio"
};

type Category = "motion" | "decor" | "palette" | "lighting";

type Rule = {
  category: Category;
  value: AnimationId | DecorId | PaletteId | LightingId;
  phrases: string[];
};

/** Phrases are matched after diacritics are stripped. Longer phrases are listed too. */
const RULES: Rule[] = [
  {
    category: "motion",
    value: "float",
    phrases: ["pluteste", "pluteasca", "zboara", "in aer"]
  },
  { category: "motion", value: "dance", phrases: ["danseaza", "danseze"] },
  { category: "motion", value: "jump", phrases: ["sare", "sara", "salta"] },
  { category: "motion", value: "wave", phrases: ["saluta", "face cu mana"] },
  { category: "motion", value: "still", phrases: ["linistit", "sta"] },
  { category: "decor", value: "stars", phrases: ["stele", "stea", "spatiu", "cosmos"] },
  { category: "decor", value: "cloud", phrases: ["nori", "nor"] },
  { category: "decor", value: "grass", phrases: ["iarba", "gradina"] },
  { category: "decor", value: "tree", phrases: ["copac", "padure"] },
  { category: "decor", value: "house", phrases: ["casa"] },
  { category: "decor", value: "planet", phrases: ["planeta", "luna"] },
  { category: "decor", value: "balloons", phrases: ["baloane", "balon"] },
  {
    category: "palette",
    value: "bright",
    phrases: ["culori vii", "colorata", "colorat", "vesel", "stralucitoare", "stralucitor"]
  },
  { category: "palette", value: "soft", phrases: ["pastel", "blanda", "bland", "moale"] },
  {
    category: "palette",
    value: "original",
    phrases: ["ca desenul", "pastreaza culorile", "original"]
  },
  { category: "lighting", value: "warm", phrases: ["insorit", "soare", "cald", "apus"] },
  { category: "lighting", value: "studio", phrases: ["studio", "clar", "curat"] }
];

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

export function limitIdeaPrompt(input: string): string {
  return input.replace(/\u0000/g, "").slice(0, IDEA_PROMPT_MAX);
}

export function normalizeIdeaPrompt(input: string): string {
  const collapsed = limitIdeaPrompt(input).replace(/\s+/g, " ").trim().toLowerCase();
  let out = "";
  for (const char of collapsed) {
    out += DIACRITICS[char] ?? char;
  }
  return out;
}

function lastPhraseEnd(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "g");
  let end = -1;
  for (const match of text.matchAll(pattern)) {
    end = match.index + match[0].length;
  }
  return end;
}

function labelOf(options: { id: string; label: string }[], id: string): string {
  return options.find((item) => item.id === id)?.label ?? id;
}

export function interpretIdeaPrompt(input: string): IdeaPromptResult {
  const text = limitIdeaPrompt(input);
  const normalized = normalizeIdeaPrompt(text);
  const best = new Map<Category, { end: number; value: string }>();

  if (normalized.length > 0) {
    for (const rule of RULES) {
      for (const phrase of rule.phrases) {
        const end = lastPhraseEnd(normalized, phrase);
        if (end < 0) continue;
        const current = best.get(rule.category);
        if (!current || end >= current.end) {
          best.set(rule.category, { end, value: rule.value });
        }
      }
    }
  }

  const motion = best.get("motion")?.value as AnimationId | undefined;
  const decor = best.get("decor")?.value as DecorId | undefined;
  const palette = best.get("palette")?.value as PaletteId | undefined;
  const lighting = best.get("lighting")?.value as LightingId | undefined;
  const recognized = Boolean(motion || decor || palette || lighting);
  const lines: string[] = [];
  if (motion) lines.push(`Mișcare: ${labelOf(ANIMATIONS, motion)}`);
  if (decor) lines.push(`Decor: ${labelOf(DECOR_ASSETS, decor)}`);
  if (palette) lines.push(`Culori: ${PALETTE_LINE[palette]}`);
  if (lighting) lines.push(`Lumină: ${LIGHTING_LINE[lighting]}`);

  return { recognized, text, motion, decor, palette, lighting, lines };
}
