/**
 * Studio Figurină 3D — same Tripo pipeline as /studio/[projectId].
 * POST/GET /api/projects/:id/figurine. Worker holds TRIPO_API_KEY.
 */

export function figurineApiPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/figurine`;
}

export type FigurineClientError = "auth" | "gated" | "source" | "active" | "generic" | "network";

export type FigurineJobView = {
  status: string;
  phase?: string;
  progress: number;
  label: string;
  publicUrl: string | null;
  failureMessage?: string | null;
};

export type FigurineStatusView = {
  available: boolean;
  message: string;
  modelUrl: string | null;
  job: FigurineJobView | null;
};

export const FIGURINE_ERROR_COPY: Record<FigurineClientError, string> = {
  auth: "Trebuie să fii autentificat ca să generezi figurina.",
  gated: "Generarea 3D nu este activată încă pe acest mediu.",
  source: "Pentru Figurină 3D, alege sau decupează un singur personaj, animal ori obiect.",
  active: "O generare Figurină 3D este deja în curs pentru acest proiect.",
  generic: "Nu am putut porni Figurină 3D. Încearcă din nou.",
  network: "Nu am putut porni Figurină 3D. Verifică conexiunea și încearcă din nou."
};

export function pickFigurineModelUrl(body: {
  figurineModelUrl?: string | null;
  job?: { publicUrl?: string | null } | null;
}): string | null {
  const fromJob = body.job?.publicUrl?.trim();
  if (fromJob) return fromJob;
  const fromProject = body.figurineModelUrl?.trim();
  return fromProject || null;
}

export function shouldPollFigurine(job: FigurineJobView | null): boolean {
  if (!job) return false;
  if (job.status === "error" || job.phase === "failed") return false;
  if (job.status === "done" || job.phase === "ready") return false;
  return (
    job.status === "queued" ||
    job.status === "running" ||
    job.phase === "queued" ||
    job.phase === "submitting" ||
    job.phase === "provider_queued" ||
    job.phase === "provider_running" ||
    job.phase === "retopologizing" ||
    job.phase === "downloading" ||
    job.phase === "validating"
  );
}

function readJson(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export function interpretFigurineStatus(body: unknown): FigurineStatusView {
  const data = readJson(body);
  const availability = readJson(data.availability);
  const jobRaw = data.job && typeof data.job === "object" ? (data.job as Record<string, unknown>) : null;
  const job: FigurineJobView | null = jobRaw
    ? {
        status: typeof jobRaw.status === "string" ? jobRaw.status : "",
        phase: typeof jobRaw.phase === "string" ? jobRaw.phase : undefined,
        progress: typeof jobRaw.progress === "number" ? jobRaw.progress : 0,
        label: typeof jobRaw.label === "string" ? jobRaw.label : "",
        publicUrl: typeof jobRaw.publicUrl === "string" ? jobRaw.publicUrl : null,
        failureMessage: typeof jobRaw.failureMessage === "string" ? jobRaw.failureMessage : null
      }
    : null;
  return {
    available: availability.available === true,
    message: typeof availability.message === "string" ? availability.message : "",
    modelUrl: pickFigurineModelUrl({
      figurineModelUrl: typeof data.figurineModelUrl === "string" ? data.figurineModelUrl : null,
      job
    }),
    job
  };
}

export function interpretStartFigurineResponse(
  status: number,
  body: unknown
): { ok: true; label: string } | { ok: false; error: FigurineClientError } {
  const data = readJson(body);
  const error = typeof data.error === "string" ? data.error : "";
  if (status === 200 || status === 201) {
    return { ok: true, label: typeof data.label === "string" ? data.label : "În pregătire" };
  }
  if (status === 401) return { ok: false, error: "auth" };
  if (status === 409 || error === "active_job") return { ok: false, error: "active" };
  if (
    status === 403 ||
    error === "generation_disabled" ||
    error === "feature_gated" ||
    error === "config_missing"
  ) {
    return { ok: false, error: "gated" };
  }
  if (
    error === "source_missing" ||
    error === "source_unsuitable" ||
    error === "confirmation_required"
  ) {
    return { ok: false, error: "source" };
  }
  return { ok: false, error: "generic" };
}

export async function readFigurineStatus(projectId: string): Promise<
  { ok: true; status: FigurineStatusView } | { ok: false; error: FigurineClientError }
> {
  try {
    const response = await fetch(figurineApiPath(projectId), { method: "GET" });
    const body = await response.json().catch(() => null);
    if (response.status === 401) return { ok: false, error: "auth" };
    if (!response.ok) return { ok: false, error: "generic" };
    return { ok: true, status: interpretFigurineStatus(body) };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function startFigurineGeneration(projectId: string): Promise<
  { ok: true; label: string } | { ok: false; error: FigurineClientError }
> {
  try {
    const response = await fetch(figurineApiPath(projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true })
    });
    const body = await response.json().catch(() => null);
    return interpretStartFigurineResponse(response.status, body);
  } catch {
    return { ok: false, error: "network" };
  }
}
