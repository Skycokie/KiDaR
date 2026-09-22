/**
 * Isolated fixture data for `/creaza-preview` only.
 * Create Go B may POST /api/projects; source upload and other writes stay blocked.
 */

export type CreazaPreviewStep = "preset" | "foto" | "experienta" | "confirmare";

export type FotoFixtureState =
  | "empty"
  | "drag-over"
  | "selected"
  | "error"
  | "loading";

export type ExperienceChoice = "popout" | "gallery";

export const CREAZA_STEPS: {
  id: CreazaPreviewStep;
  index: number;
  label: string;
  short: string;
}[] = [
  { id: "preset", index: 1, label: "Punctul de pornire", short: "Pornire" },
  { id: "foto", index: 2, label: "Poza ta", short: "Poză" },
  { id: "experienta", index: 3, label: "Cum prinde viață", short: "Scenă" },
  { id: "confirmare", index: 4, label: "Lumea ta", short: "Lume" }
];

export const TOTAL_STEPS = CREAZA_STEPS.length;

export const PRESET_DOORS = [
  {
    id: "coloring" as const,
    title: "Un desen colorat",
    detail: "Personaje, obiecte, pagini din caiet — orice linie care vrea să iasă din hârtie.",
    art: "whale" as const
  },
  {
    id: "story" as const,
    title: "O pagină de poveste",
    detail: "Ilustrații din cărți și scene care pot deveni o poartă.",
    art: "garden" as const
  },
  {
    id: "mission" as const,
    title: "O misiune",
    detail: "Indicii, chei și provocări pentru jocuri și clase.",
    art: "kite" as const
  }
];

export const EXPERIENCE_DOORS = [
  {
    id: "popout" as const,
    title: "Iese din pagină",
    detail: "Ridicăm ce e important din desen — calm, clar, magic."
  },
  {
    id: "gallery" as const,
    title: "O figurină deasupra",
    detail: "Alegi un personaj sau un obiect care apare pe pagină.",
    soon: true
  }
];

export const FOTO_FIXTURE_LABELS: Record<FotoFixtureState, string> = {
  empty: "Fără poză",
  "drag-over": "Drag-over",
  selected: "Poză selectată",
  error: "Poză invalidă",
  loading: "Se salvează… (mock)"
};

export const COPY = {
  brandKicker: "kidAR · Creează",
  previewBadge: "Creează · 4 pași",
  preset: {
    title: "Cu ce începe lumea?",
    lead: "Alegi un tip de desen. Apoi aduci o poză pe masă și îi dai o scenă.",
    cta: "Începe lumea",
    ctaBusy: "Pregătim surpriza…"
  },
  foto: {
    title: "Așază poza pe masă",
    lead: "O fotografie clară a hârtiei. Fără ecrane, fără umbre grele.",
    dropEmpty: "Așază poza aici",
    dropHint: "JPG sau PNG · până la 10 MB",
    dropSelected: "Poza ta e pe masă",
    dropError: "Putem folosi doar JPG sau PNG, până la 10 MB.",
    dropLoading: "Salvăm poza…",
    tips: ["Fotografiați pagina întreagă", "Lumină blândă, fără flash puternic", "Nu fotografiați un ecran"],
    cta: "Salvează poza și continuă",
    ctaBusy: "Salvăm poza…",
    back: "Înapoi"
  },
  experienta: {
    title: "Cum vrei să prindă viață?",
    lead: "Alege scena pe această pagină. Se salvează pe lume doar când apeși butonul de mai jos.",
    cta: "Salvează scena și continuă",
    ctaBusy: "Salvăm scena…",
    back: "Înapoi la poză"
  },
  confirmare: {
    title: "Lumea ta e pregătită să înceapă",
    lead: "Am păstrat alegerea ta. Deschide Studio ca să continui lumea, sau începe alta.",
    summaryPreset: "Punct de pornire",
    summaryFoto: "Poză",
    summaryScene: "Scenă",
    again: "Începe altă lume",
    atelier: "Deschide Studio",
    note: "Draft-ul are începutul, poza și scena salvate. Continuă în Studio când ești gata."
  }
} as const;
