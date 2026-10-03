/**
 * Studio: POST /api/projects/:id/asset kind=model (user GLB).
 */

export function assetModelApiPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/asset`;
}

export type UploadModelResult =
  | { ok: true; path: string; url: string; uploadModelUrl: string | null }
  | { ok: false; error: string; code?: string };

export async function uploadStudioModelGlb(
  projectId: string,
  file: File
): Promise<UploadModelResult> {
  const body = new FormData();
  body.set("kind", "model");
  body.set("file", file);
  try {
    const response = await fetch(assetModelApiPath(projectId), {
      method: "POST",
      body
    });
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      path?: string;
      url?: string;
      uploadModelUrl?: string | null;
    };
    if (!response.ok) {
      return { ok: false, error: json.error ?? `upload_${response.status}`, code: json.code };
    }
    if (!json.path || !json.url) {
      return { ok: false, error: "invalid_response" };
    }
    return {
      ok: true,
      path: json.path,
      url: json.url,
      uploadModelUrl: json.uploadModelUrl ?? null
    };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "network" };
  }
}
