/**
 * Isolated fixture data for the Atelier (`/creaza`).
 * Create Go B may POST /api/projects; source upload and other writes stay blocked.
 * Copy lives in `messages.creaza`; this file only holds structure.
 */

export type CreazaPreviewStep = "preset" | "foto" | "experienta" | "confirmare";

export type FotoFixtureState =
  | "empty"
  | "drag-over"
  | "selected"
  | "error"
  | "loading";

export type ExperienceChoice = "popout" | "gallery";

export const CREAZA_STEPS: { id: CreazaPreviewStep; index: number }[] = [
  { id: "preset", index: 1 },
  { id: "foto", index: 2 },
  { id: "experienta", index: 3 },
  { id: "confirmare", index: 4 }
];

export const TOTAL_STEPS = CREAZA_STEPS.length;

export const STARTING_POINT_DOORS = [
  { id: "character" as const, art: "who" as const },
  { id: "story" as const, art: "what" as const },
  { id: "world" as const, art: "where" as const }
] as const;

export const EXPERIENCE_DOORS: { id: ExperienceChoice; soon: boolean }[] = [
  { id: "popout", soon: false },
  { id: "gallery", soon: true }
];

export const FOTO_FIXTURE_STATES: { id: FotoFixtureState; key: "empty" | "dragOver" | "selected" | "error" | "loading" }[] = [
  { id: "empty", key: "empty" },
  { id: "drag-over", key: "dragOver" },
  { id: "selected", key: "selected" },
  { id: "error", key: "error" },
  { id: "loading", key: "loading" }
];
