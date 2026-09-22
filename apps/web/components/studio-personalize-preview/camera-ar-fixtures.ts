/**
 * Cameră AR Preview Go B — simulated states only.
 * No device camera, no tracking, no real project data.
 */

export const CAMERA_AR_STUDIO_HREF = "/studio-preview/personalizeaza";

export const CAMERA_AR_COPY = {
  badge: "Previzualizare — camera nu pornește încă",
  introTitle: "Privește poza prin cameră. Observă cum prinde viață.",
  introLead: "Aceasta este o previzualizare statică. Nu cerem acces la cameră.",
  tryPreview: "Încearcă previzualizarea",
  preparing: "Pregătim privirea.",
  continue: "Continuă",
  searching: "Caută poza în fața ta.",
  simulateFound: "Simulează: poza găsită",
  found: "Am găsit poza.",
  simulateLost: "Simulează: poza pierdută",
  lost: "Nu mai văd poza.",
  showAgain: "Arată-mi poza din nou",
  unavailable: "Camera nu este disponibilă.",
  incompatible: "Această previzualizare funcționează cel mai bine pe telefon.",
  backStudio: "Înapoi la Studio",
  demoLabel: "Simulează alte stări",
  demoUnavailable: "Cameră indisponibilă",
  demoIncompatible: "Browser necompatibil",
  fixtureTitle: "Grădina de după ploaie",
  worldHint: "Lume fixture · Fluture · Stele · Apus"
} as const;

export type CameraArPhase =
  | "intro"
  | "preparing"
  | "searching"
  | "found"
  | "lost"
  | "unavailable"
  | "incompatible";

/** Fixed decorative overlay for found state — independent of Studio React state. */
export const CAMERA_AR_FIXTURE_OVERLAY = {
  character: "butterfly" as const,
  effect: "stars" as const,
  atmosphere: "sunset" as const
};
