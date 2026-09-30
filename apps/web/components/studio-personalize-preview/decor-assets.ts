/**
 * Studio decor props (Meshy), derived from the manifest that ships in public/.
 *
 * The manifest is the single source of truth: the file the browser can fetch at
 * /demo/decor/manifest.json is the same file compiled in here, so the advertised
 * props and the shipped binaries cannot drift apart. Ids missing from it have no
 * binary and must never be offered.
 */
import type { DecorId } from "./fixtures";
import manifest from "@/public/demo/decor/manifest.json";

export interface DecorManifestEntry {
  id: string;
  label: string;
  src: string;
}

export interface DecorManifest {
  version: number;
  credit: string;
  assets: DecorManifestEntry[];
}

export const DECOR_MANIFEST = manifest as DecorManifest;

const SHIPPED = new Map<string, string>(DECOR_MANIFEST.assets.map((a) => [a.id, a.src]));

/** GLB path per decor id. Absent ids ship no binary. */
export const DECOR_GLB_SRC: Partial<Record<DecorId, string>> = Object.fromEntries(SHIPPED);

/** Decor ids that ship a GLB in this deploy bundle. */
export const DECOR_GLB_AVAILABLE: ReadonlySet<DecorId> = new Set(
  DECOR_MANIFEST.assets.map((a) => a.id as DecorId)
);

export function decorGlbAvailable(id: DecorId): boolean {
  return DECOR_GLB_AVAILABLE.has(id);
}

/** Resolved GLB path, or null when the prop ships no binary. */
export function decorGlbSrc(id: DecorId): string | null {
  return SHIPPED.get(id) ?? null;
}
