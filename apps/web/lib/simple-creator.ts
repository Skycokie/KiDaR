import type { CreatorPreset, ProjectMode } from "@kidar/core";

export const CREATOR_PRESETS = ["coloring", "story", "mission"] as const satisfies readonly CreatorPreset[];

export type SimpleCreatorPreset = (typeof CREATOR_PRESETS)[number];

export const CREATOR_PRESET_COPY: Record<
  SimpleCreatorPreset,
  { title: string; description: string }
> = {
  coloring: {
    title: "Colorat",
    description: "Pentru desene, personaje și imagini colorate."
  },
  story: {
    title: "Poveste",
    description: "Pentru pagini de carte și ilustrații preferate."
  },
  mission: {
    title: "Misiune",
    description: "Pentru indicii din jocuri, școli și escape rooms."
  }
};

export function isSimpleCreatorPreset(value: unknown): value is SimpleCreatorPreset {
  return CREATOR_PRESETS.includes(value as SimpleCreatorPreset);
}

/** UX-1 always starts the technical pipeline as pop-out. */
export function technicalModeForPreset(_preset: CreatorPreset): ProjectMode {
  return "popout";
}

export function friendlySurpriseName(now: Date = new Date(), locale = "ro-RO"): string {
  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(now);
  return `Surpriza din ${when}`;
}
