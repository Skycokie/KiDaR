/**
 * Creative starting points for `/creaza`.
 * IDs only — copy lives in `messages.creaza.preset`.
 * Selection is local. Create still POSTs the technical coloring preset.
 */

import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/types";
import { hrefForLocale } from "@/i18n/locale";
import type { SimpleCreatorPreset } from "@/lib/simple-creator";

export const CREATIVE_STARTING_POINTS = ["character", "story", "world"] as const;

export type CreativeStartingPoint = (typeof CREATIVE_STARTING_POINTS)[number];

export type CreativeSuggestionIndex = 0 | 1 | 2;

export type CreativeStartingPointState = {
  kind: CreativeStartingPoint;
  selectedSuggestion?: string;
};

/** Backend `settings.preset` — not a product mode. All three cards share this. */
export const TECHNICAL_CREATE_PRESET: SimpleCreatorPreset = "coloring";

export function isCreativeStartingPoint(value: unknown): value is CreativeStartingPoint {
  return CREATIVE_STARTING_POINTS.includes(value as CreativeStartingPoint);
}

export function isCreativeSuggestionIndex(value: unknown): value is CreativeSuggestionIndex {
  return value === 0 || value === 1 || value === 2;
}

export function parseCreativeSuggestionIndex(value: unknown): CreativeSuggestionIndex | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(raw, 10);
  return isCreativeSuggestionIndex(n) ? n : null;
}

export function parseCreativeStartingPoint(value: unknown): CreativeStartingPoint | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return isCreativeStartingPoint(raw) ? raw : null;
}

export function creativeIdeaPrompt(
  copy: Messages["creaza"]["preset"],
  kind: CreativeStartingPoint,
  hint: CreativeSuggestionIndex | null = null
): string {
  const seed = copy.seeds[kind];
  if (hint == null) return seed;
  return `${seed} ${copy.doors[kind].suggestions[hint]}`;
}

export function creazaPersonalizeHref(
  projectId: string,
  locale: Locale,
  kind: CreativeStartingPoint | null,
  hint: CreativeSuggestionIndex | null
): string {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (kind) params.set("from", kind);
  if (hint != null) params.set("hint", String(hint));
  return `${hrefForLocale("/studio-preview/personalizeaza", locale)}?${params.toString()}`;
}
