/**
 * Isolated fixture data for Studio ("Lumile tale").
 * Not connected to Appwrite, R2, or production project models.
 * Copy lives in `messages.worlds`; this file only holds structure.
 */

export type FixtureStatus = "draft" | "ready" | "published" | "coming-soon";

export type FixtureView = "atelier" | "create" | "worlds" | "library" | "settings";

export type FixtureAssetKind = "drawing" | "character" | "sound" | "scene";

export type WorldCrop = "portrait" | "panorama" | "square";

export type FixtureProjectKey = "aurora" | "garden" | "kite";

export type FixtureAssetKey = "whale" | "fox" | "dragon" | "chime" | "sticker" | "orchard";

export type CreateChoiceId = "drawing" | "photo" | "character" | "idea";

export interface FixtureProject {
  id: string;
  key: FixtureProjectKey;
  status: Exclude<FixtureStatus, "coming-soon">;
  crop: WorldCrop;
  art: "aurora" | "garden" | "kite";
}

export interface FixtureAsset {
  id: string;
  key: FixtureAssetKey;
  kind: FixtureAssetKind;
  size: "large" | "tall" | "small" | "wide";
  art: "whale" | "fox" | "dragon" | "chime" | "sticker" | "garden";
}

/** Primary Atelier/Studio routes live in SiteHeader; this is the bottom dock. */
export const MOBILE_NAV: Extract<FixtureView, "create" | "worlds" | "library">[] = [
  "create",
  "worlds",
  "library"
];

export const FIXTURE_PROJECTS: FixtureProject[] = [
  { id: "proj-aurora", key: "aurora", status: "published", crop: "portrait", art: "aurora" },
  { id: "proj-garden", key: "garden", status: "ready", crop: "panorama", art: "garden" },
  { id: "proj-kite", key: "kite", status: "draft", crop: "square", art: "kite" }
];

export const FIXTURE_ASSETS: FixtureAsset[] = [
  { id: "a1", key: "whale", kind: "drawing", size: "large", art: "whale" },
  { id: "a2", key: "fox", kind: "character", size: "small", art: "fox" },
  { id: "a3", key: "dragon", kind: "character", size: "tall", art: "dragon" },
  { id: "a4", key: "chime", kind: "sound", size: "wide", art: "chime" },
  { id: "a5", key: "sticker", kind: "scene", size: "small", art: "sticker" },
  { id: "a6", key: "orchard", kind: "drawing", size: "tall", art: "garden" }
];

export const CREATE_CHOICES: { id: CreateChoiceId; available: boolean; art: "whale" | "garden" | "fox" | "kite" }[] = [
  { id: "drawing", available: true, art: "whale" },
  { id: "photo", available: false, art: "garden" },
  { id: "character", available: false, art: "fox" },
  { id: "idea", available: false, art: "kite" }
];

export const LIBRARY_FILTERS: ("all" | FixtureAssetKind)[] = ["all", "drawing", "character", "sound", "scene"];
