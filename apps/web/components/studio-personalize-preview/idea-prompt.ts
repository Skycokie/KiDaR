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

export type PromptLanguage = "ro" | "en";

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

const ENGLISH_RULES: Rule[] = [
  { category: "motion", value: "float", phrases: ["in the air", "float", "fly"] },
  { category: "motion", value: "dance", phrases: ["dance"] },
  { category: "motion", value: "jump", phrases: ["jump"] },
  { category: "motion", value: "wave", phrases: ["wave"] },
  { category: "motion", value: "still", phrases: ["still", "calm"] },
  { category: "decor", value: "stars", phrases: ["stars", "space"] },
  { category: "decor", value: "cloud", phrases: ["cloud"] },
  { category: "decor", value: "grass", phrases: ["garden", "grass"] },
  { category: "decor", value: "tree", phrases: ["tree"] },
  { category: "decor", value: "house", phrases: ["house"] },
  { category: "decor", value: "planet", phrases: ["planet"] },
  { category: "decor", value: "balloons", phrases: ["balloons", "balloon"] },
  { category: "palette", value: "bright", phrases: ["colorful", "bright"] },
  { category: "palette", value: "soft", phrases: ["soft", "pastel"] },
  { category: "palette", value: "original", phrases: ["original"] },
  { category: "lighting", value: "warm", phrases: ["warm", "sunny"] },
  { category: "lighting", value: "studio", phrases: ["studio"] }
];

export type PromptMapping = {
  locale: PromptLanguage;
  terms: {
    motion: Record<string, AnimationId>;
    decor: Record<string, DecorId>;
    palette: Record<string, PaletteId>;
    lighting: Record<string, LightingId>;
  };
};

function toMapping(locale: PromptLanguage, rules: Rule[]): PromptMapping {
  const terms: PromptMapping["terms"] = { motion: {}, decor: {}, palette: {}, lighting: {} };
  for (const rule of rules) {
    for (const phrase of rule.phrases) {
      if (rule.category === "motion") terms.motion[phrase] = rule.value as AnimationId;
      if (rule.category === "decor") terms.decor[phrase] = rule.value as DecorId;
      if (rule.category === "palette") terms.palette[phrase] = rule.value as PaletteId;
      if (rule.category === "lighting") terms.lighting[phrase] = rule.value as LightingId;
    }
  }
  return { locale, terms };
}

export const PROMPT_MAPPINGS: Record<PromptLanguage, PromptMapping> = {
  ro: toMapping("ro", RULES),
  en: toMapping("en", ENGLISH_RULES)
};

function rulesFor(locale: PromptLanguage): Rule[] {
  return locale === "en" ? ENGLISH_RULES : RULES;
}

const EN_LINES = {
  motion: { wave: "Wave", float: "Float", dance: "Dance", jump: "Jump", still: "Still" },
  decor: {
    cloud: "Cloud",
    stars: "Stars",
    grass: "Grass",
    tree: "Tree",
    house: "House",
    planet: "Planet",
    balloons: "Balloons"
  },
  palette: { original: "Original", bright: "Bright", soft: "Soft" },
  lighting: { warm: "Warm", studio: "Studio" }
} as const;

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

export function interpretIdeaPrompt(input: string, locale: PromptLanguage = "ro"): IdeaPromptResult {
  const text = limitIdeaPrompt(input);
  const normalized = normalizeIdeaPrompt(text);
  const best = new Map<Category, { end: number; value: string }>();
  const rules = rulesFor(locale === "en" ? "en" : "ro");

  if (normalized.length > 0) {
    for (const rule of rules) {
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
  if (locale === "en") {
    if (motion) lines.push(`Motion: ${EN_LINES.motion[motion]}`);
    if (decor) lines.push(`Decor: ${EN_LINES.decor[decor]}`);
    if (palette) lines.push(`Colors: ${EN_LINES.palette[palette]}`);
    if (lighting) lines.push(`Light: ${EN_LINES.lighting[lighting]}`);
  } else {
    if (motion) lines.push(`Mișcare: ${labelOf(ANIMATIONS, motion)}`);
    if (decor) lines.push(`Decor: ${labelOf(DECOR_ASSETS, decor)}`);
    if (palette) lines.push(`Culori: ${PALETTE_LINE[palette]}`);
    if (lighting) lines.push(`Lumină: ${LIGHTING_LINE[lighting]}`);
  }

  return { recognized, text, motion, decor, palette, lighting, lines };
}
