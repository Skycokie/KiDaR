import { NextResponse } from "next/server";
import {
  FIGURINE_DISCLOSURE_RO,
  FIGURINE_MAX_ASSETS_PER_PROJECT,
  FIGURINE_PROVIDER,
  countReadyFigurineAssets,
  figurineProgressLabel,
  hasActiveFigurineSubject,
  resolveFigurineAvailability,
  type FigurineSubjectRecord,
  type ProjectMode
} from "@kidar/core";
import { computeInputHash, sha256Hex } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob, findJobByInputHash } from "@/lib/appwrite/jobs";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";
import { isFigurineFeatureEnabled } from "@/lib/figurine-feature";

type Context = { params: { projectId: string } };

function sourceRef(sourceImagePath: string | null) {
  if (!sourceImagePath) return null;
  return {
    fileId: sourceImagePath,
    checksum: sha256Hex(`appwrite:${APPWRITE_SOURCE_BUCKET}:${sourceImagePath}`)
  };
}

function primarySubject(
  settings: { figurineSubjects?: FigurineSubjectRecord[] },
  sourceFileId: string
): FigurineSubjectRecord {
  const existing = settings.figurineSubjects?.find((s) => s.id === "primary");
  return (
    existing ?? {
      id: "primary",
      sourceFileId,
      label: "Personaj",
      status: "queued",
      progress: 0
    }
  );
}

/**
 * Web availability never inspects TRIPO_API_KEY.
 * Worker fails closed if Tripo is missing when the job runs.
 */
function projectFigurineAvailability(project: {
  source_image_path: string | null;
  settings?: { figurineSubjects?: FigurineSubjectRecord[] };
}) {
  const hasSource = Boolean(project.source_image_path);
  return resolveFigurineAvailability({
    featureEnabled: isFigurineFeatureEnabled(),
    // Tripo credentials are worker-only; web treats provider as ready when feature flag is on.
    tripoConfigured: true,
    hasIsolatedSource: hasSource,
    sourceSuitable: hasSource,
    subjects: project.settings?.figurineSubjects
  });
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const availability = projectFigurineAvailability(project);

  const inputHash = computeInputHash({
    projectId: project.id,
    mode: "figurine_3d",
    source: sourceRef(project.source_image_path),
    settings: project.settings
  });
  const job = await findJobByInputHash({
    projectId: project.id,
    type: "figurine_build",
    inputHash
  });

  const phase =
    (typeof job?.result?.phase === "string" && job.result.phase) ||
    (job?.status === "done"
      ? "ready"
      : job?.status === "error"
        ? "failed"
        : job?.status === "running" || job?.status === "queued"
          ? "provider_running"
          : undefined);

  return NextResponse.json({
    mode: project.mode,
    availability,
    disclosure: FIGURINE_DISCLOSURE_RO,
    subjects: project.settings?.figurineSubjects ?? [],
    figurineModelUrl: project.settings?.figurineModelUrl ?? null,
    job: job
      ? {
          id: job.id,
          status: job.status,
          phase,
          progress:
            typeof job.result?.progress === "number"
              ? job.result.progress
              : job.status === "done"
                ? 100
                : 0,
          label: figurineProgressLabel(phase),
          publicUrl:
            typeof job.result?.publicUrl === "string" ? job.result.publicUrl : null,
          failureCode:
            typeof job.result?.failureCode === "string" ? job.result.failureCode : null,
          failureMessage:
            typeof job.result?.failureMessage === "string"
              ? job.result.failureMessage
              : job.lastError
        }
      : null,
    limits: {
      maxAssets: FIGURINE_MAX_ASSETS_PER_PROJECT,
      readyAssets: countReadyFigurineAssets(project.settings?.figurineSubjects)
    }
  });
}

/**
 * Explicit start of Figurină 3D generation.
 * Enqueues work for the Hetzner worker (paid Tripo calls happen there only).
 */
export async function POST(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    confirm?: boolean;
    subjectId?: string;
  };
  if (body.confirm !== true) {
    return NextResponse.json(
      {
        error: "confirmation_required",
        message: "Set confirm:true to start Figurină 3D generation.",
        disclosure: FIGURINE_DISCLOSURE_RO
      },
      { status: 400 }
    );
  }

  const availability = projectFigurineAvailability(project);

  if (!availability.available) {
    return NextResponse.json(
      {
        error: availability.reason,
        message: availability.message
      },
      { status: 400 }
    );
  }

  if (hasActiveFigurineSubject(project.settings?.figurineSubjects)) {
    return NextResponse.json(
      {
        error: "active_job",
        message: "O generare Figurină 3D este deja în curs pentru acest proiect"
      },
      { status: 409 }
    );
  }

  const sourceFileId = project.source_image_path!;
  const subjectId = body.subjectId?.trim() || "primary";
  const inputHash = computeInputHash({
    projectId: project.id,
    mode: "figurine_3d",
    source: sourceRef(sourceFileId),
    settings: {
      ...project.settings,
      figurineModelUrl: project.settings.figurineModelUrl
    }
  });

  const subject = {
    ...primarySubject(project.settings, sourceFileId),
    id: subjectId,
    sourceFileId,
    status: "queued" as const,
    progress: 0,
    provider: FIGURINE_PROVIDER
  };

  await updateProjectDocument(params.projectId, {
    mode: "figurine_3d" satisfies ProjectMode,
    status: "processing",
    settings: {
      ...project.settings,
      figurineSubjects: [
        ...(project.settings.figurineSubjects ?? []).filter((s) => s.id !== subjectId),
        subject
      ]
    }
  });

  const enqueued = await enqueueJob({
    projectId: project.id,
    type: "figurine_build",
    inputHash,
    ownerId: user.$id,
    payload: {
      source: "studio_figurine",
      subjectId
    }
  });

  if (enqueued.kind === "idempotent_done") {
    return NextResponse.json({
      ok: true,
      kind: enqueued.kind,
      jobId: enqueued.job.id,
      publicUrl:
        typeof enqueued.job.result?.publicUrl === "string"
          ? enqueued.job.result.publicUrl
          : null,
      label: figurineProgressLabel("ready")
    });
  }

  return NextResponse.json({
    ok: true,
    kind: enqueued.kind,
    jobId: enqueued.job.id,
    label: figurineProgressLabel("queued"),
    disclosure: FIGURINE_DISCLOSURE_RO
  });
}
