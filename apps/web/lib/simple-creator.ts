import type { CreatorPreset, ProjectMode, ProjectSettingsPatch } from "@kidar/core";

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

export const SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const SOURCE_SMALL_BYTES = 50 * 1024;
/** Phone libraries often offer HEIC/WebP; we convert those to JPEG before upload. */
export const SOURCE_ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,image/webp,.jpg,.jpeg,.png,.heic,.heif,.webp";
export const MISSION_MESSAGE_MAX = 80;

const SOURCE_RASTER_TYPES = new Set(["image/jpeg", "image/png"]);
const SOURCE_CONVERTIBLE_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
  "image/bmp"
]);

export type ExperienceChoice = "popout" | "gallery";

export const EXPERIENCE_COPY: Record<
  ExperienceChoice,
  { title: string; lead: string; hint: string }
> = {
  popout: {
    title: "Iese din pagină",
    lead: "Ridicăm elementele principale din imagine.",
    hint: "Este potrivit pentru desene simple și personaje mari."
  },
  gallery: {
    title: "Alege o figurină",
    lead: "Alege un personaj sau un obiect care apare deasupra paginii.",
    hint: "Este recomandat pentru pagini de poveste mai încărcate."
  }
};

export const GALLERY_CHIPS = [
  { label: "Personaj", query: "character" },
  { label: "Dragon", query: "dragon" },
  { label: "Cheie", query: "key" }
] as const;

export function isSimpleCreatorPreset(value: unknown): value is SimpleCreatorPreset {
  return CREATOR_PRESETS.includes(value as SimpleCreatorPreset);
}

/** UX-1 always starts the technical pipeline as pop-out. */
export function technicalModeForPreset(_preset: CreatorPreset): ProjectMode {
  return "popout";
}

export function modeForExperienceChoice(choice: ExperienceChoice): ProjectMode {
  return choice;
}

export function showsMissionMessage(preset: unknown): boolean {
  return preset === "mission";
}

export function clipMissionMessage(value: string): string {
  return value.trim().slice(0, MISSION_MESSAGE_MAX);
}

export function mimeFromFileName(name?: string): string {
  const lower = (name ?? "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "";
}

export function resolveSourceMime(file: { type?: string; name?: string }): string {
  if (file.type && file.type !== "application/octet-stream") return file.type.toLowerCase();
  return mimeFromFileName(file.name);
}

export function isSourceRasterMime(type: string): boolean {
  return SOURCE_RASTER_TYPES.has(type);
}

export function isSourceConvertibleMime(type: string): boolean {
  return SOURCE_CONVERTIBLE_TYPES.has(type);
}

export function validateSourceImage(file: { type?: string; size: number; name?: string }): {
  ok: boolean;
  code?: "type" | "size";
  small: boolean;
} {
  const type = resolveSourceMime(file);
  if (!isSourceRasterMime(type) && !isSourceConvertibleMime(type)) {
    return { ok: false, code: "type", small: false };
  }
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, code: "size", small: false };
  }
  return { ok: true, small: file.size > 0 && file.size < SOURCE_SMALL_BYTES };
}

export function sourceUploadPath(projectId: string): string {
  return `/api/projects/${projectId}/source`;
}

export function projectPatchPath(projectId: string): string {
  return `/api/projects/${projectId}`;
}

export function gallerySearchPath(query: string): string {
  return `/api/gallery?query=${encodeURIComponent(query)}`;
}

export function isPublishPath(url: string): boolean {
  return /\/api\/publish(?:\?|$)/.test(url);
}

export function friendlyFigureName(name?: string | null): string {
  if (!name || /poly pizza/i.test(name)) return "Figurină";
  return name;
}

export function experiencePatch(input: {
  choice: ExperienceChoice;
  preset?: unknown;
  ctaText?: string;
  galleryModelUrl?: string | null;
}): { mode: ProjectMode; settings: ProjectSettingsPatch } {
  const settings: ProjectSettingsPatch = {};
  if (isSimpleCreatorPreset(input.preset)) {
    settings.preset = input.preset;
  }
  if (showsMissionMessage(input.preset)) {
    const message = clipMissionMessage(input.ctaText ?? "");
    settings.ctaText = message || undefined;
  }
  if (input.choice === "gallery" && input.galleryModelUrl) {
    settings.galleryModelUrl = input.galleryModelUrl;
  }
  return {
    mode: modeForExperienceChoice(input.choice),
    settings
  };
}

export function friendlySurpriseName(
  now: Date = new Date(),
  locale = "ro-RO",
  template = "Surpriza din {date}"
): string {
  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(now);
  return template.replace("{date}", when);
}
