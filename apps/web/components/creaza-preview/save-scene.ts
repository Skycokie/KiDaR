/**
 * Scene Go B — single PATCH /api/projects/:projectId from `/creaza-preview`.
 * Body is only `{ mode: "popout" }`. Never stores ProjectRecord; never patches settings.
 */

import { projectPatchPath, type ExperienceChoice } from "@/lib/simple-creator";

export type SceneSavePayload = {
  mode: "popout";
};

export type SceneSaveClientError =
  | "missing-project"
  | "invalid-scene"
  | "auth"
  | "not-found"
  | "bad-request"
  | "generic"
  | "network";

export type SceneSaveResult =
  | { ok: true }
  | {
      ok: false;
      error: "auth" | "not-found" | "bad-request" | "generic" | "network";
    };

export function buildSceneSavePayload(): SceneSavePayload {
  return { mode: "popout" };
}

/** Atelier v1: only popout is a valid writable scene. */
export function isWritableScene(experience: ExperienceChoice): experience is "popout" {
  return experience === "popout";
}

/**
 * Interprets a settled PATCH response. Does not auto-retry.
 * Success does not extract or return the project document.
 */
export async function interpretSceneSaveResponse(
  response: Response
): Promise<SceneSaveResult> {
  if (response.status === 200) {
    return { ok: true };
  }

  if (response.status === 401) {
    return { ok: false, error: "auth" };
  }

  if (response.status === 404) {
    return { ok: false, error: "not-found" };
  }

  if (response.status === 400) {
    return { ok: false, error: "bad-request" };
  }

  return { ok: false, error: "generic" };
}

export async function patchSceneMode(
  projectId: string,
  fetchImpl: typeof fetch = fetch
): Promise<SceneSaveResult> {
  const url = projectPatchPath(projectId);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSceneSavePayload())
    });
  } catch {
    return { ok: false, error: "network" };
  }
  return interpretSceneSaveResponse(response);
}

export function isProjectPatchPath(url: string): boolean {
  let path = url.split("?")[0] ?? url;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    // keep split path
  }
  path = path.replace(/\/+$/, "") || "/";
  return /^\/api\/projects\/[^/]+$/.test(path);
}
