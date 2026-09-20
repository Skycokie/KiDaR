/**
 * Isolated fixture data for `/studio-preview` only.
 * Not connected to Appwrite, R2, or production project models.
 */

export type FixtureStatus = "draft" | "ready" | "published" | "coming-soon";

export type FixtureView = "atelier" | "create" | "worlds" | "library" | "settings";

export type FixtureAssetKind = "drawing" | "character" | "sound" | "scene";

export type WorldCrop = "portrait" | "panorama" | "square";

export interface FixtureProject {
  id: string;
  title: string;
  line: string;
  status: FixtureStatus;
  crop: WorldCrop;
  art: "aurora" | "garden" | "kite";
}

export interface FixtureAsset {
  id: string;
  title: string;
  kind: FixtureAssetKind;
  meta: string;
  size: "large" | "tall" | "small" | "wide";
  art: "whale" | "fox" | "dragon" | "chime" | "sticker" | "garden";
}

export const HEADER_NAV: { id: FixtureView; label: string }[] = [
  { id: "atelier", label: "Atelier" },
  { id: "worlds", label: "Lumi" },
  { id: "library", label: "Bibliotecă" }
];

export const MOBILE_NAV: { id: FixtureView; label: string }[] = [
  { id: "atelier", label: "Atelier" },
  { id: "create", label: "Creează" },
  { id: "worlds", label: "Lumi" },
  { id: "library", label: "Bibliotecă" }
];

export const FIXTURE_PROJECTS: FixtureProject[] = [
  {
    id: "proj-aurora",
    title: "Aurora",
    line: "Un dragon de creion iese din noapte.",
    status: "published",
    crop: "portrait",
    art: "aurora"
  },
  {
    id: "proj-garden",
    title: "Grădina ascunsă",
    line: "Pagina ilustrată se deschide ca o poartă.",
    status: "ready",
    crop: "panorama",
    art: "garden"
  },
  {
    id: "proj-kite",
    title: "Zmeu de hârtie",
    line: "Un desen de după-amiază, încă neterminat.",
    status: "draft",
    crop: "square",
    art: "kite"
  }
];

export const FIXTURE_ASSETS: FixtureAsset[] = [
  {
    id: "a1",
    title: "Balena de pe cer",
    kind: "drawing",
    meta: "Desen · privat",
    size: "large",
    art: "whale"
  },
  {
    id: "a2",
    title: "Vulpea din pădure",
    kind: "character",
    meta: "Personaj",
    size: "small",
    art: "fox"
  },
  {
    id: "a3",
    title: "Dragon de hârtie",
    kind: "character",
    meta: "Personaj",
    size: "tall",
    art: "dragon"
  },
  {
    id: "a4",
    title: "Clopoțel moale",
    kind: "sound",
    meta: "Sunet · 4s",
    size: "wide",
    art: "chime"
  },
  {
    id: "a5",
    title: "Abțibild de clasă",
    kind: "scene",
    meta: "Scenă",
    size: "small",
    art: "sticker"
  },
  {
    id: "a6",
    title: "Livadă schițată",
    kind: "drawing",
    meta: "Desen · privat",
    size: "tall",
    art: "garden"
  }
];

export const CREATE_CHOICES = [
  {
    id: "drawing",
    title: "Un desen",
    detail: "Pornim de la o pagină, o schiță sau o ilustrație.",
    state: "Disponibil acum" as const,
    available: true,
    art: "whale" as const
  },
  {
    id: "photo",
    title: "O fotografie",
    detail: "O poză de pe masă sau din album, transformată în poartă.",
    state: "În curând" as const,
    available: false,
    art: "garden" as const
  },
  {
    id: "character",
    title: "Un personaj",
    detail: "Alegi cine iese din pagină — din bibliotecă sau dintr-o idee.",
    state: "În curând" as const,
    available: false,
    art: "fox" as const
  },
  {
    id: "idea",
    title: "O idee",
    detail: "Cuvinte care vor deveni formă, când AI-ul va fi gata.",
    state: "În curând" as const,
    available: false,
    art: "kite" as const
  }
];

export const LIBRARY_FILTERS: { id: "all" | FixtureAssetKind; label: string }[] = [
  { id: "all", label: "Toate" },
  { id: "drawing", label: "Desene" },
  { id: "character", label: "Personaje" },
  { id: "sound", label: "Sunete" },
  { id: "scene", label: "Scene" }
];
