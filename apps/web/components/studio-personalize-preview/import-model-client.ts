/**
 * Client helpers for Studio import (gallery search + GLB file).
 * Kept out of personalize-shell so FormData/fetch stay off the shell source.
 */

import { friendlyFigureName, gallerySearchPath, projectPatchPath } from "@/lib/simple-creator";

export type GalleryModelHit = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  glbUrl: string | null;
};

export type ImportModelResult =
  | { ok: true; modelUrl: string; publicUrl: string | null; promoted: boolean; source: "gallery" | "file" }
  | { ok: false; error: "auth" | "network" | "invalid" | "too_large" | "generic" };

export function projectAssetPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/asset`;
}

export async function searchGalleryModels(query: string): Promise<GalleryModelHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const response = await fetch(gallerySearchPath(trimmed), { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { models?: GalleryModelHit[] };
  return (payload.models ?? []).filter((item) => Boolean(item.glbUrl));
}

export async function selectGalleryModel(
  projectId: string,
  glbUrl: string
): Promise<ImportModelResult> {
  try {
    const response = await fetch(projectPatchPath(projectId), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "gallery",
        settings: { galleryModelUrl: glbUrl }
      })
    });
    if (response.status === 401) return { ok: false, error: "auth" };
    if (!response.ok) return { ok: false, error: "generic" };
    return { ok: true, modelUrl: glbUrl, publicUrl: glbUrl, promoted: true, source: "gallery" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function postImportedGlbFile(projectId: string, file: File): Promise<ImportModelResult> {
  if (!file.name.toLowerCase().endsWith(".glb") && file.type !== "model/gltf-binary") {
    return { ok: false, error: "invalid" };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { ok: false, error: "too_large" };
  }
  try {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", "model");
    const response = await fetch(projectAssetPath(projectId), { method: "POST", body });
    if (response.status === 401) return { ok: false, error: "auth" };
    if (response.status === 413) return { ok: false, error: "too_large" };
    if (response.status === 415) return { ok: false, error: "invalid" };
    if (!response.ok) return { ok: false, error: "generic" };
    const payload = (await response.json()) as {
      url?: string;
      publicUrl?: string | null;
      promoted?: boolean;
    };
    const previewUrl = payload.publicUrl || payload.url;
    if (!previewUrl) return { ok: false, error: "generic" };
    return {
      ok: true,
      modelUrl: previewUrl,
      publicUrl: payload.publicUrl ?? null,
      promoted: Boolean(payload.promoted),
      source: "file"
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export { friendlyFigureName };
