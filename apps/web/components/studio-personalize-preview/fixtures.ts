/**
 * Studio personalize preview — fixture-only workspace.
 * No ProjectRecord, projectId, sourceUrl, or private assets.
 */

export const PERSONALIZE_BACK_HREF = "/studio-preview";
export const PERSONALIZE_CAMERA_HREF = "/studio-preview/personalizeaza/camera";
export const PERSONALIZE_STUDIO_HREF = "/studio-preview/personalizeaza";

export const FIXTURE_WORLD = {
  title: "Grădina de după ploaie",
  status: "Previzualizare",
  mode: "Popout",
  note: "Fixture local — fără sourceUrl real"
} as const;

export const COPY = {
  brandKicker: "Studio",
  title: "Lumea mea",
  lead: "Alege, reglează și vezi personajul pe scenă.",
  previewNote: "Schimbările rămân doar pe acest ecran.",
  sidebarLabel: "Lumea mea",
  pathLabel: "Traseu",
  savedLocal: "Salvat local",
  publish: "Publică",
  publishPrepareTitle: "Pregătește lumea pentru publicare",
  publishLinkNote: "Lumea ta va primi un link și un cod QR.",
  publishStartNote: "Poziția de start salvată va fi folosită la următoarea publicare.",
  publishLaterNote: "Publicarea reală va fi activată după ce verificăm experiența AR.",
  publishQrLabel: "Previzualizare cod QR",
  publishWorld: "Publică lumea",
  publishInactive: "Publicarea reală nu este activată încă.",
  publishBack: "Înapoi în Studio",
  seeInAr: "Vezi în AR",
  arPreviewNote:
    "Previzualizare locală pe acest ecran — fără cameră, fără tracking și fără publicare.",
  stageHint: "Trage pentru a roti · scroll pentru zoom.",
  popoutRotateHint: "Rotește lumea pentru a vedea straturile.",
  showOriginalPage: "Arată pagina originală",
  pageReference: "Referință",
  rotateLeft: "Rotește stânga",
  rotateRight: "Rotește dreapta",
  tiltUp: "Înclină sus",
  tiltDown: "Înclină jos",
  rollCcw: "Rotește pe plan stânga",
  rollCw: "Rotește pe plan dreapta",
  rollGroup: "Rotație pe plan",
  autoRotate: "Pornește/Oprește rotirea 360°",
  autoRotateOff: "360°",
  autoRotateStop: "Oprește 360°",
  autoRotateActive: "Activ",
  resetView: "Resetează vederea",
  popoutPreparing: "Pregătim straturile desenului…",
  popoutSeparateFailed: "Nu am putut separa elementele desenului în acest preview.",
  popoutRetry: "Încearcă din nou",
  figurineVolumeHint: "O interpretare cu volum a desenului tău.",
  volume: "Volum",
  details: "Detalii",
  aspect: "Aspect",
  giveLife: "Dă viață",
  placeInWorld: "Așază în lume",
  preserveOutline: "Păstrează conturul desenului",
  originalColors: "Culori originale",
  regenerate: "Generează variantă",
  modeSection: "Cum apare",
  styleSection: "Stil",
  variantSoon: "Variante",
  grid: "Grilă",
  frame: "Încadrează",
  zoom: "Zoom",
  leftNavOpen: "Traseu",
  rightNavOpen: "Reglaje",
  closePanel: "Închide",
  sheetHandle: "Trage pentru a închide"
} as const;

export type StudioStageId =
  | "desenul"
  | "personajul"
  | "aspect"
  | "miscare"
  | "decor"
  | "testeaza";

export type TransformModeId = "popout" | "figurine";
export type StylePresetId = "preserve" | "clay" | "painted";
export type AnimationId = "wave" | "float" | "dance" | "jump" | "still";
export type DecorId = "cloud" | "stars" | "grass" | "tree" | "house" | "planet" | "balloons";
export type CameraPresetId = "front" | "threequarter" | "side" | "top" | "reset";

export type ChoiceOption<T extends string> = {
  id: T;
  label: string;
  hint?: string;
};

/** Narrative path — short labels for the left rail. */
export const STAGES: ChoiceOption<StudioStageId>[] = [
  { id: "desenul", label: "Desen", hint: "Hârtia de start" },
  { id: "personajul", label: "Personaj", hint: "Ridică forma" },
  { id: "aspect", label: "Aspect", hint: "Lumină și culoare" },
  { id: "miscare", label: "Mișcare", hint: "Dă viață" },
  { id: "decor", label: "Decor", hint: "Așază în lume" },
  { id: "testeaza", label: "AR", hint: "Privește prin cameră" }
];

export const TRANSFORM_MODES: ChoiceOption<TransformModeId>[] = [
  { id: "popout", label: "Pop-out din desen", hint: "Ridicat din hârtie, ușor plat" },
  { id: "figurine", label: "Figurină 3D", hint: "Rotund, de ținut în mână" }
];

export const STYLE_PRESETS: ChoiceOption<StylePresetId>[] = [
  { id: "preserve", label: "Păstrează desenul", hint: "Linii și culori din original" },
  { id: "clay", label: "Lut colorat", hint: "Suprafață moale, mată" },
  { id: "painted", label: "Jucărie pictată", hint: "Lac cald, detalii clare" }
];

export const ANIMATIONS: ChoiceOption<AnimationId>[] = [
  { id: "wave", label: "Salută" },
  { id: "float", label: "Plutește" },
  { id: "dance", label: "Dansează" },
  { id: "jump", label: "Sare" },
  { id: "still", label: "Stă liniștit" }
];

export const DECOR_ASSETS: ChoiceOption<DecorId>[] = [
  { id: "cloud", label: "Nor" },
  { id: "stars", label: "Stele" },
  { id: "grass", label: "Iarbă" },
  { id: "tree", label: "Copac" },
  { id: "house", label: "Casă" },
  { id: "planet", label: "Planetă" },
  { id: "balloons", label: "Baloane" }
];

export const CAMERA_PRESETS: ChoiceOption<CameraPresetId>[] = [
  { id: "front", label: "Față" },
  { id: "threequarter", label: "3/4" },
  { id: "side", label: "Lateral" },
  { id: "top", label: "Sus" },
  { id: "reset", label: "Reset" }
];
