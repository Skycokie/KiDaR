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
  savedLocal: "Salvat în această sesiune",
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
  seeInArPreparing: "AR în pregătire",
  arPreviewNote:
    "Previzualizare 2D locală pe acest ecran — fără cameră, fără tracking și fără publicare.",
  arCardCaption: "Previzualizare 2D locală",
  arCardEmpty: "Cadru demonstrativ",
  emptyDrawing: "Ca să personalizezi previzualizarea, adaugă o poză sau un desen din Atelier.",
  drawingReady: "Desenul salvat din Atelier e pe scenă. Continuă ca să ridici personajul din hârtie.",
  demoPreview: "Previzualizare demonstrativă",
  figurineDemo: "Previzualizare locală. Nu s-a generat o figurină 3D.",
  noDecor: "Fără decor",
  paletteSection: "Culori",
  lightingSection: "Lumină",
  ideaLabel: "Ideea ta pentru figurină",
  ideaHeading: "Spune-i AI-ului ce îți imaginezi",
  ideaSupport: "Scrie o idee, iar previzualizarea se schimbă aici, în Studio.",
  ideaPlaceholder: "De exemplu: Vreau ca personajul meu să plutească printre stele.",
  ideaApply: "Aplică în previzualizare",
  ideaSuggestions: "Încearcă o idee",
  ideaResult: "Am ales pentru previzualizare",
  ideaFallback: "Poți alege apoi mișcarea, decorul și culorile din Studio.",
  ideaHonest: "Aceasta schimbă doar previzualizarea. Figurina 3D se pregătește separat.",
  ideaReset: "Resetează ideea",
  ideaEmpty: "Scrie întâi o idee pentru previzualizare.",
  ideaNeedsDrawing: "Adaugă o poză sau un desen ca să aplici o idee în previzualizare.",
  interactTitle: "Interacțiuni",
  interactSubtitle: "Joacă-te cu scena",
  interactIntro: "Poți explora previzualizarea fără să schimbi alegerile scenei.",
  interactStart: "Activează interacțiunile",
  interactActive: "Interacțiuni active",
  interactStop: "Oprește interacțiunile",
  interactHint: "Trage personajul, folosește zoomul sau apasă pe scenă.",
  interactZoom: "Apropie",
  interactZoomIn: "Apropie scena",
  interactZoomOut: "Depărtează scena",
  interactReset: "Resetează scena",
  interactLeft: "Stânga",
  interactRight: "Dreapta",
  interactCharacter: "Personajul reacționează în previzualizare.",
  interactDecor: "Decorul reacționează în previzualizare.",
  interactHonest: "Aceasta este o interacțiune locală. Nu pornește generarea și nu deschide AR.",
  interactArLater: "Interacțiunile AR vor fi disponibile separat, după pregătirea și aprobarea scenei 3D.",
  interactNeedsDrawing: "Adaugă mai întâi un desen pentru a explora scena.",
  stepLocked: "Adaugă un desen ca să deschizi acest pas.",
  stageHint: "Trage pentru a roti · scroll pentru zoom.",
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
  popoutPreparing: "Pregătim Pop-out-ul…",
  popoutSeparateFailed: "Nu am putut separa elementele desenului în acest preview.",
  popoutRetry: "Încearcă din nou",
  figurineVolumeHint: "Previzualizare demonstrativă. Nu s-a generat o figurină 3D.",
  volume: "Volum",
  details: "Detalii",
  aspect: "Aspect",
  giveLife: "Dă viață",
  placeInWorld: "Așază în lume",
  preserveOutline: "Păstrează conturul desenului",
  originalColors: "Culori originale",
  regenerate: "Aplică varianta în previzualizare",
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
export type PaletteId = "original" | "bright" | "soft";
export type LightingId = "warm" | "studio";

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
  { id: "testeaza", label: "AR", hint: "Previzualizare locală" }
];

export const TRANSFORM_MODES: ChoiceOption<TransformModeId>[] = [
  { id: "popout", label: "Pop-out din desen", hint: "Ridicat din hârtie, ușor plat" },
  { id: "figurine", label: "Figurină 3D", hint: "Previzualizare demonstrativă" }
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

export const PALETTES: ChoiceOption<PaletteId>[] = [
  { id: "original", label: "Original" },
  { id: "bright", label: "Culori vii" },
  { id: "soft", label: "Culori moi" }
];

export const LIGHTINGS: ChoiceOption<LightingId>[] = [
  { id: "warm", label: "Lumină caldă" },
  { id: "studio", label: "Lumină de studio" }
];

export const CAMERA_PRESETS: ChoiceOption<CameraPresetId>[] = [
  { id: "front", label: "Față" },
  { id: "threequarter", label: "3/4" },
  { id: "side", label: "Lateral" },
  { id: "top", label: "Sus" },
  { id: "reset", label: "Reset" }
];
