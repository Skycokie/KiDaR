/**
 * Studio Preview Go B — fixture-only personalize surface.
 * No ProjectRecord, projectId, sourceUrl, or private assets.
 */

export const PERSONALIZE_BACK_HREF = "/studio-preview";
export const PERSONALIZE_CAMERA_HREF = "/studio-preview/personalizeaza/camera";

export const FIXTURE_WORLD = {
  title: "Grădina de după ploaie",
  status: "Previzualizare",
  mode: "Popout",
  note: "Poster CSS/SVG local — fără sourceUrl real"
} as const;

export const COPY = {
  brandKicker: "Studio",
  title: "Fă lumea ta mai a ta.",
  lead: "Personalizează lumea cu câteva alegeri simple.",
  previewNote: "Schimbările tale sunt o previzualizare.",
  ctaCamera: "Vezi prin cameră",
  ctaBack: "Înapoi la lumi",
  cameraPlaceholderTitle: "Previzualizare Cameră AR — în curând",
  cameraPlaceholderLead:
    "Aici va apărea privirea prin cameră. Deocamdată e doar un ecran static — fără cameră reală și fără tracking.",
  cameraBack: "Înapoi la personalizare",
  panelTitle: "Personalizează",
  showInWorld: "Arată în lume",
  summaryLabel: "Alegerea ta",
  comingSoon: "În curând"
} as const;

export type CharacterId = "none" | "butterfly" | "dragon" | "mooncat";
export type EffectId = "none" | "stars" | "clouds" | "leaves" | "sparks" | "confetti";
export type AtmosphereId = "morning" | "sunset" | "night" | "dream";
export type SoundId = "silence" | "rain" | "forest" | "gentle";
export type PositionId = "top" | "bottom" | "left" | "right" | "center";
export type ScaleId = "small" | "medium" | "large";

export type ChoiceOption<T extends string> = {
  id: T;
  label: string;
};

export const CHARACTERS: ChoiceOption<CharacterId>[] = [
  { id: "none", label: "Niciunul" },
  { id: "butterfly", label: "Fluture" },
  { id: "dragon", label: "Dragon blând" },
  { id: "mooncat", label: "Pisică-lună" }
];

export const EFFECTS: ChoiceOption<EffectId>[] = [
  { id: "none", label: "Niciunul" },
  { id: "stars", label: "Stele" },
  { id: "clouds", label: "Nori" },
  { id: "leaves", label: "Frunze" },
  { id: "sparks", label: "Scântei" },
  { id: "confetti", label: "Confetti" }
];

export const ATMOSPHERES: ChoiceOption<AtmosphereId>[] = [
  { id: "morning", label: "Dimineață" },
  { id: "sunset", label: "Apus" },
  { id: "night", label: "Noapte" },
  { id: "dream", label: "Vis" }
];

export const SOUNDS: ChoiceOption<SoundId>[] = [
  { id: "silence", label: "Liniște" },
  { id: "rain", label: "Ploaie" },
  { id: "forest", label: "Pădure" },
  { id: "gentle", label: "Muzică blândă" }
];

export const POSITIONS: ChoiceOption<PositionId>[] = [
  { id: "top", label: "Sus" },
  { id: "bottom", label: "Jos" },
  { id: "left", label: "Stânga" },
  { id: "right", label: "Dreapta" },
  { id: "center", label: "Centru" }
];

export const SCALES: ChoiceOption<ScaleId>[] = [
  { id: "small", label: "Mică" },
  { id: "medium", label: "Medie" },
  { id: "large", label: "Mare" }
];

/** Decorative non-functional control — visual “În curând” only. */
export const COMING_SOON_CONTROL = {
  id: "own-upload",
  label: "Propriu",
  soon: true as const
};
