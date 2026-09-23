/**
 * Create Go B — single POST /api/projects from `/creaza-preview`.
 * Stores only project.id. Never uploads source or patches settings.
 */

import {
  friendlySurpriseName,
  type SimpleCreatorPreset
} from "@/lib/simple-creator";

export const CREATE_PROJECT_PATH = "/api/projects";

export type CreateProjectPayload = {
  name: string;
  mode: "popout";
  settings: { preset: SimpleCreatorPreset };
};

export type CreateProjectClientError =
  | "select"
  | "auth"
  | "quota"
  | "generic"
  | "ambiguous";

export type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: Exclude<CreateProjectClientError, "select"> };

export function buildCreateProjectPayload(
  preset: SimpleCreatorPreset,
  now: Date = new Date()
): CreateProjectPayload {
  return {
    name: friendlySurpriseName(now),
    mode: "popout",
    settings: { preset }
  };
}

export function extractCreatedProjectId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const project = (body as { project?: { id?: unknown; $id?: unknown } }).project;
  if (!project || typeof project !== "object") return null;
  if (typeof project.id === "string" && project.id.trim()) return project.id.trim();
  if (typeof project.$id === "string" && project.$id.trim()) return project.$id.trim();
  return null;
}

/**
 * Interprets a settled HTTP response. Does not auto-retry.
 * Ambiguous / non-201 outcomes never claim the draft was absent.
 */
export async function interpretCreateProjectResponse(
  response: Response
): Promise<CreateProjectResult> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 201) {
    const projectId = extractCreatedProjectId(body);
    if (!projectId) {
      return { ok: false, error: "ambiguous" };
    }
    return { ok: true, projectId };
  }

  if (response.status === 401) {
    return { ok: false, error: "auth" };
  }

  if (
    response.status === 403 &&
    body &&
    typeof body === "object" &&
    ((body as { error?: string }).error === "quota_exceeded" ||
      (body as { upgrade?: boolean }).upgrade === true)
  ) {
    return { ok: false, error: "quota" };
  }

  return { ok: false, error: "generic" };
}

export async function postCreateProject(
  payload: CreateProjectPayload,
  fetchImpl: typeof fetch = fetch
): Promise<CreateProjectResult> {
  let response: Response;
  try {
    response = await fetchImpl(CREATE_PROJECT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // Timeout / network loss — may hide a successful create; no auto-retry.
    return { ok: false, error: "ambiguous" };
  }
  return interpretCreateProjectResponse(response);
}
