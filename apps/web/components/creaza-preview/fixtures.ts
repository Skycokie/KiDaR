/**
 * Isolated fixture data for `/creaza-preview` only.
 * Never calls Appwrite, R2, or `/api/*`.
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
  { id: "foto", index: 2, label: "Desenul tău", short: "Desen" },
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
  empty: "Fără imagine",
  "drag-over": "Drag-over",
  selected: "Imagine selectată",
  error: "Eroare validare",
  loading: "Se salvează… (mock)"
};

export const COPY = {
  brandKicker: "kidAR · Creează",
  previewBadge: "Previzualizare — fără scrieri",
  preset: {
    title: "Cu ce începe lumea?",
    lead: "Alegi un tip de desen. Apoi îl aduci pe masă și îi dai o scenă.",
    cta: "Continuă cu desenul"
  },
  foto: {
    title: "Așază desenul pe masă",
    lead: "O fotografie clară a hârtiei. Fără ecrane, fără umbre grele.",
    dropEmpty: "Așază fotografia aici",
    dropHint: "JPG sau PNG · până la 10 MB",
    dropSelected: "Desenul tău e pe masă",
    dropError: "Putem folosi doar JPG sau PNG, până la 10 MB.",
    dropLoading: "Pregătim desenul…",
    tips: ["Fotografiați pagina întreagă", "Lumină blândă, fără flash puternic", "Nu fotografiați un ecran"],
    cta: "Alege scena",
    back: "Înapoi"
  },
  experienta: {
    title: "Cum vrei să prindă viață?",
    lead: "O alegere mare, nu un formular. Mai târziu legăm asta de salvarea existentă.",
    cta: "Salvează alegerea",
    back: "Înapoi la desen"
  },
  confirmare: {
    title: "Lumea ta e pregătită să înceapă",
    lead: "Am păstrat alegerea ta. Experiența AR live apare după fluxul real de creare — nu aici, în previzualizare.",
    summaryPreset: "Punct de pornire",
    summaryFoto: "Desen",
    summaryScene: "Scenă",
    again: "Începe altă lume",
    atelier: "Înapoi la Atelier",
    note: "Nimic nu a fost creat, încărcat sau publicat din acest ecran."
  }
} as const;
