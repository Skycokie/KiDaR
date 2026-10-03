/**
 * Studio publish status + enqueue helpers.
 */

export type PublishPublicUrls = {
  html: string | null;
  qr: string | null;
  pdf: string | null;
  experience: string | null;
};

export type PublishStatusResponse = {
  projectId: string;
  projectStatus: string;
  planError: string | null;
  phase: "idle" | "building" | "ready" | "failed";
  steps: Array<{
    type: string;
    status: string | null;
    blocked: boolean;
    progress: number;
    label: string;
    error: string | null;
  }>;
  publicUrls: PublishPublicUrls;
  ready: boolean;
};

export function publishStatusPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/publish`;
}

export function shouldPollPublish(status: PublishStatusResponse | null): boolean {
  if (!status) return false;
  return status.phase === "building";
}

export async function readPublishStatus(projectId: string): Promise<
  | { ok: true; status: PublishStatusResponse }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch(publishStatusPath(projectId), { method: "GET" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `status_${response.status}` };
    }
    const status = (await response.json()) as PublishStatusResponse;
    return { ok: true, status };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "status_failed" };
  }
}

export async function startPublish(
  projectId: string,
  options?: { acceptTerms?: boolean }
): Promise<
  | { ok: true; enqueue: string }
  | { ok: false; error: string; code?: string }
> {
  try {
    const response = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        acceptTerms: options?.acceptTerms === true
      })
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      enqueue?: string;
    };
    if (!response.ok) {
      return { ok: false, error: body.error ?? `publish_${response.status}`, code: body.code };
    }
    return { ok: true, enqueue: body.enqueue ?? "queued" };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "publish_failed" };
  }
}
