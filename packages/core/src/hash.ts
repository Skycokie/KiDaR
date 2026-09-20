import { createHash } from "node:crypto";
import { buildMindCompileInputDocument, type MindCompileInputParts } from "./mind";
import { POPOUT_PIPELINE_VERSION } from "./popout";
import { AR_PAGE_TEMPLATE_VERSION } from "./templates/ar-page";
import { PAGE_RENDER_PIPELINE_VERSION } from "./page-render";
import { PRINT_PIPELINE_VERSION } from "./print/pdf";
import type { JobType } from "./jobs";

/** Bump when pipeline inputs or templates change meaning for public artifacts. */
export const PIPELINE_INPUT_VERSION = "m4.1.0";

/** Reserved for later stages once encoder output stability is measured. */
export const PIPELINE_ARTIFACT_VERSION = "m4.1.0";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Structural settings slice used for hashing (avoids circular imports with index). */
export interface HashableProjectSettings {
  title: string;
  theme: string;
  ctaText?: string;
  ctaUrl?: string;
  galleryModelUrl?: string;
  uploadModelPath?: string;
  logoPath?: string;
  soundPath?: string;
  scale: number;
  offset: { x: number; y: number; z: number };
}

/**
 * Deterministic JSON serialization: object keys sorted recursively.
 * Arrays preserve order (array order is semantically meaningful).
 */
export function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("canonicalize rejects non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry === undefined) continue;
      sorted[key] = canonicalize(entry);
    }
    return sorted;
  }
  throw new Error(`canonicalize cannot serialize ${typeof value}`);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export interface SourceInputRef {
  /** Immutable Appwrite file id or equivalent. */
  fileId: string;
  /** Content checksum of the source bytes (sha256 hex). */
  checksum: string;
}

export interface PipelineInputParts {
  projectId: string;
  mode: "popout" | "gallery" | "upload";
  source: SourceInputRef | null;
  settings: HashableProjectSettings;
  /** Optional extra transform knobs that affect artifacts. */
  transforms?: Record<string, JsonValue>;
  /** Model / sound identities already mirrored on settings; allow explicit overrides. */
  modelFileId?: string | null;
  soundFileId?: string | null;
  pipelineVersion?: string;
}

/**
 * Build the canonical object hashed as `inputHash`.
 * Excludes timestamps, random IDs, signed URLs, hostnames, and secrets.
 * AR HTML template version is intentionally omitted — page_render has its own
 * hash via `computePageRenderInputHash` so GLB/.mind keys stay stable.
 */
export function buildPipelineInputDocument(parts: PipelineInputParts): Record<string, JsonValue> {
  const settings = parts.settings;
  return {
    pipelineVersion: parts.pipelineVersion ?? PIPELINE_INPUT_VERSION,
    // Pop-out UV pipeline only. Gallery/mind hashes stay null so MindAR is not rebuilt.
    popoutPipelineVersion: parts.mode === "popout" ? POPOUT_PIPELINE_VERSION : null,
    projectId: parts.projectId,
    mode: parts.mode,
    source: parts.source
      ? { fileId: parts.source.fileId, checksum: parts.source.checksum }
      : null,
    modelFileId: parts.modelFileId ?? settings.uploadModelPath ?? null,
    soundFileId: parts.soundFileId ?? settings.soundPath ?? null,
    transforms: parts.transforms ?? {},
    settings: {
      title: settings.title,
      theme: settings.theme,
      ctaText: settings.ctaText ?? null,
      ctaUrl: settings.ctaUrl ?? null,
      logoPath: settings.logoPath ?? null,
      soundPath: settings.soundPath ?? null,
      uploadModelPath: settings.uploadModelPath ?? null,
      galleryModelUrl: settings.galleryModelUrl ?? null,
      scale: settings.scale,
      offset: {
        x: settings.offset.x,
        y: settings.offset.y,
        z: settings.offset.z
      }
    }
  };
}

export function computeInputHash(parts: PipelineInputParts): string {
  return hashCanonical(buildPipelineInputDocument(parts));
}

/**
 * Canonical page_render identity. Template/CSP/boot changes bump
 * `AR_PAGE_TEMPLATE_VERSION` and write a new `pages/<projectId>/<hash>/`
 * namespace. Pop-out GLB and targets.mind keep using `computeInputHash`.
 *
 * `inputHash` already covers projectId, title, theme, CTA, logo, sound,
 * transform, source, and mode. This document adds QR/PDF/HTML-only fields
 * that must not move GLB/.mind keys: public app origin, asset origin, slug,
 * watermark, and print/page renderer versions.
 */
export interface PageRenderHashParts {
  inputHash: string;
  templateVersion?: string;
  slug?: string | null;
  publicAppOrigin?: string | null;
  publicAssetOrigin?: string | null;
  showWatermark?: boolean;
  pageRenderPipelineVersion?: string;
  printPipelineVersion?: string;
}

function originIdentity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function buildPageRenderInputDocument(parts: PageRenderHashParts): Record<string, JsonValue> {
  return {
    kind: "page_render",
    inputHash: parts.inputHash,
    arPageTemplateVersion: parts.templateVersion ?? AR_PAGE_TEMPLATE_VERSION,
    pageRenderPipelineVersion: parts.pageRenderPipelineVersion ?? PAGE_RENDER_PIPELINE_VERSION,
    printPipelineVersion: parts.printPipelineVersion ?? PRINT_PIPELINE_VERSION,
    slug: parts.slug && parts.slug.trim() ? parts.slug.trim() : null,
    publicAppOrigin: originIdentity(parts.publicAppOrigin),
    publicAssetOrigin: originIdentity(parts.publicAssetOrigin),
    showWatermark: Boolean(parts.showWatermark)
  };
}

export function computePageRenderInputHash(parts: PageRenderHashParts): string {
  return hashCanonical(buildPageRenderInputDocument(parts));
}

export function jobInputHashForType(
  type: JobType,
  contentInputHash: string,
  pageRender?: Omit<PageRenderHashParts, "inputHash">
): string {
  if (type === "page_render") {
    return computePageRenderInputHash({ inputHash: contentInputHash, ...pageRender });
  }
  return contentInputHash;
}

/**
 * Hash of inputs that actually change the Pop-out GLB (cutout + theme + UV pipeline).
 * Page copy, CTA, and runtime transform are excluded so they do not rewrite GLB keys.
 */
export function buildPopoutInputDocument(parts: {
  projectId: string;
  source: SourceInputRef;
  theme: string;
  pipelineVersion?: string;
}): Record<string, JsonValue> {
  return {
    popoutPipelineVersion: parts.pipelineVersion ?? POPOUT_PIPELINE_VERSION,
    projectId: parts.projectId,
    source: { fileId: parts.source.fileId, checksum: parts.source.checksum },
    theme: parts.theme
  };
}

export function computePopoutInputHash(parts: {
  projectId: string;
  source: SourceInputRef;
  theme: string;
  pipelineVersion?: string;
}): string {
  return hashCanonical(buildPopoutInputDocument(parts));
}

/**
 * Artifact hash convention for later stages.
 * Do not assert byte-identical third-party encoder output until measured.
 */
export function buildArtifactHashDocument(parts: {
  inputHash: string;
  artifactKind: string;
  contentChecksum?: string;
  pipelineVersion?: string;
}): Record<string, JsonValue> {
  return {
    pipelineVersion: parts.pipelineVersion ?? PIPELINE_ARTIFACT_VERSION,
    inputHash: parts.inputHash,
    artifactKind: parts.artifactKind,
    contentChecksum: parts.contentChecksum ?? null
  };
}

export function computeArtifactHash(parts: {
  inputHash: string;
  artifactKind: string;
  contentChecksum?: string;
  pipelineVersion?: string;
}): string {
  return hashCanonical(buildArtifactHashDocument(parts));
}

export function computeMindCompileInputHash(parts: MindCompileInputParts): string {
  return hashCanonical(buildMindCompileInputDocument(parts));
}
