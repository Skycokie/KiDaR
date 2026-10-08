/**
 * Pure helpers for project delete + public unpublish key collection.
 * Never touches Appwrite or R2 — callers persist / delete.
 */

import { hashCanonical } from "./hash";
import { experiencePointerKey, safeExperienceSlug } from "./page-render";
import type { CharacterVoiceMap } from "./character-voice";

/** Collect private Appwrite asset file ids used by character voice clips. */
export function collectCharacterVoiceAudioPaths(
  voices: CharacterVoiceMap | undefined
): string[] {
  if (!voices || typeof voices !== "object") return [];
  const paths: string[] = [];
  for (const voice of Object.values(voices)) {
    if (!voice || typeof voice !== "object") continue;
    const path = typeof voice.audioPath === "string" ? voice.audioPath.trim() : "";
    if (path) paths.push(path);
  }
  return [...new Set(paths)];
}

/**
 * When a public CDN URL is under our base, return the object key.
 * Used to clean page artifacts written by page_render.
 */
export function objectKeyFromPublicUrl(
  publicBaseUrl: string | undefined,
  absoluteUrl: string | undefined
): string | null {
  if (!publicBaseUrl?.trim() || !absoluteUrl?.trim()) return null;
  try {
    const base = new URL(publicBaseUrl.trim());
    const target = new URL(absoluteUrl.trim());
    if (base.origin !== target.origin) return null;
    const basePath = base.pathname.replace(/\/+$/, "");
    let path = target.pathname;
    if (basePath && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
    }
    const key = path.replace(/^\/+/, "");
    if (!key || key.includes("..")) return null;
    return key;
  } catch {
    return null;
  }
}

export type UnpublishKeyInput = {
  slug?: string | null;
  publicBaseUrl?: string;
  publicHtmlUrl?: string;
  publicQrUrl?: string;
  publicPdfUrl?: string;
};

/**
 * Keys that must be removed so `/ar/<slug>` stops resolving.
 * Always includes `experiences/<slug>/target.txt` when slug is valid.
 * Also includes page artifact keys derived from known public URLs.
 */
export function collectUnpublishKeys(input: UnpublishKeyInput): string[] {
  const keys: string[] = [];
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (slug) {
    try {
      keys.push(experiencePointerKey(safeExperienceSlug(slug)));
    } catch {
      // invalid slug — nothing public to clear under experiences/
    }
  }

  for (const url of [input.publicHtmlUrl, input.publicQrUrl, input.publicPdfUrl]) {
    const key = objectKeyFromPublicUrl(input.publicBaseUrl, url);
    if (key) keys.push(key);
  }

  return [...new Set(keys)];
}

export function projectNeedsUnpublish(input: {
  slug?: string | null;
  publicHtmlUrl?: string;
  publicExperienceUrl?: string;
}): boolean {
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (!slug) return false;
  return Boolean(input.publicHtmlUrl?.trim() || input.publicExperienceUrl?.trim());
}

/** Stable idempotency hash for an unpublish job over a fixed key set. */
export function computeUnpublishInputHash(keys: string[]): string {
  return hashCanonical({
    type: "unpublish",
    keys: [...keys].sort()
  });
}

/** Allow-list for worker deletes: only experience pointers and page artifacts. */
export function isAllowedUnpublishKey(key: string): boolean {
  return (
    /^experiences\/[a-z0-9][a-z0-9_-]{0,63}\/target\.txt$/i.test(key) ||
    /^pages\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\/[a-f0-9]{64}\/[a-z0-9._-]+$/i.test(key)
  );
}
