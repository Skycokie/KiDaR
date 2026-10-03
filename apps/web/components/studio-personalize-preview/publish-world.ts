/**
 * Studio publish client: enqueue (with explicit terms consent) + status polling.
 */

export type PublishPhase = "idle" | "building" | "ready" | "failed";

export type PublishStatusResponse = {
  projectId: string;
  publishEnabled: boolean;
  planError: string | null;
  phase: PublishPhase;
  steps: Array<{ type: string; status: string | null; progress: number; error: string | null }>;
  publicUrls: { experience: string | null; pdf: string | null };
  /** Same-origin, owner-only QR PNG route; null until ready. */
  qrPath: string | null;
  ready: boolean;
};

export const PUBLISH_POLL_MS = 2500;

export function publishStatusPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/publish`;
}

export function qrDownloadHref(qrPath: string): string {
  return `${qrPath}${qrPath.includes("?") ? "&" : "?"}download=1`;
}

export function shouldPollPublish(status: PublishStatusResponse | null): boolean {
  return status?.phase === "building";
}

export function canStartPublish(input: {
  status: PublishStatusResponse | null;
  termsAccepted: boolean;
  busy: boolean;
}): boolean {
  if (input.busy || !input.termsAccepted) return false;
  if (!input.status?.publishEnabled) return false;
  if (input.status.planError) return false;
  return input.status.phase !== "building";
}

export async function readPublishStatus(
  projectId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; status: PublishStatusResponse } | { ok: false; error: string }> {
  try {
    const response = await fetchImpl(publishStatusPath(projectId), {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) return { ok: false, error: `status_${response.status}` };
    return { ok: true, status: (await response.json()) as PublishStatusResponse };
  } catch {
    return { ok: false, error: "status_failed" };
  }
}

export async function startPublish(
  projectId: string,
  acceptTerms: boolean,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; enqueue: string } | { ok: false; code: string }> {
  try {
    const response = await fetchImpl("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, acceptTerms: acceptTerms === true })
    });
    const body = (await response.json().catch(() => ({}))) as { code?: string; enqueue?: string };
    if (!response.ok) return { ok: false, code: body.code ?? `publish_${response.status}` };
    return { ok: true, enqueue: body.enqueue ?? "queued" };
  } catch {
    return { ok: false, code: "publish_failed" };
  }
}
