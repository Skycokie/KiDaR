import type { ProjectSettings } from "@kidar/core";
import { FIXTURE_PROJECTS } from "@/components/studio-preview/fixtures";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";

/** Deliberately reduced card DTO — never the full ProjectRecord. */
export type StudioWorldStatus = "draft" | "ready" | "published";

export type StudioWorldVisualVariant = "portrait" | "landscape" | "square";

export type StudioWorldCard = {
  id: string;
  title: string;
  href: string;
  status: StudioWorldStatus;
  updatedLabel: string;
  visualVariant: StudioWorldVisualVariant;
  preview?: {
    kind: "safe-preview";
    src: string;
    alt: string;
  };
};

export type StudioWorldsResult =
  | { kind: "fixtures"; worlds: StudioWorldCard[] }
  | { kind: "live"; worlds: StudioWorldCard[] }
  | { kind: "error" }
  | { kind: "loading" };

const ART_KINDS = ["aurora", "garden", "kite"] as const;
export type StudioWorldArtKind = (typeof ART_KINDS)[number];

const VARIANT_CYCLE: StudioWorldVisualVariant[] = ["portrait", "landscape", "square"];

const DATE_LOCALE: Record<Locale, string> = { ro: "ro-RO", en: "en-GB" };

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Editorial crop from id — no Appwrite fields required. */
export function visualVariantFromId(id: string): StudioWorldVisualVariant {
  return VARIANT_CYCLE[hashId(id) % VARIANT_CYCLE.length]!;
}

/** CSS/SVG artwork seed from id when no safe preview exists. */
export function artKindFromId(id: string): StudioWorldArtKind {
  return ART_KINDS[hashId(id) % ART_KINDS.length]!;
}

export function normalizeStudioWorldStatus(
  status: string,
  settings?: Pick<ProjectSettings, "publicExperienceUrl" | "publicHtmlUrl">
): StudioWorldStatus {
  const raw = status.trim().toLowerCase();
  const publishedHint = Boolean(settings?.publicExperienceUrl || settings?.publicHtmlUrl);
  if (raw === "published" || publishedHint) return "published";
  if (raw === "ready") return "ready";
  return "draft";
}

export function formatStudioUpdatedLabel(iso: string, locale: Locale = "ro", now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const t = getMessages(locale).worlds.gallery;
  const diffMs = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs >= 0 && diffMs < dayMs) return t.updatedToday;
  if (diffMs >= 0 && diffMs < 2 * dayMs) return t.updatedYesterday;

  const label = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: "numeric",
    month: "short"
  }).format(date);
  return t.updatedOn.replace("{date}", label);
}

/**
 * Map a persistence record to the public card DTO.
 * Intentionally omits owner, paths, hashes, job fields, and settings blobs.
 */
export function toStudioWorldCard(
  project: {
    id: string;
    name: string;
    status: string;
    updated_at: string;
    settings?: ProjectSettings;
  },
  locale: Locale = "ro"
): StudioWorldCard {
  const title =
    (project.settings?.title && project.settings.title.trim()) ||
    project.name.trim() ||
    getMessages(locale).worlds.gallery.untitled;

  return {
    id: project.id,
    title,
    href: `/studio/${project.id}`,
    status: normalizeStudioWorldStatus(project.status, project.settings),
    updatedLabel: formatStudioUpdatedLabel(project.updated_at, locale),
    visualVariant: visualVariantFromId(project.id)
    // No private source /api/files preview — editorial art from id only.
  };
}

export function fixtureStudioWorlds(locale: Locale = "ro"): StudioWorldCard[] {
  const copy = getMessages(locale).worlds.gallery.fixtures;
  return FIXTURE_PROJECTS.map((project) => ({
    id: project.id,
    title: copy[project.key].title,
    href: "",
    status: project.status,
    updatedLabel: copy[project.key].line,
    visualVariant:
      project.crop === "panorama" ? "landscape" : (project.crop as StudioWorldVisualVariant)
  }));
}
