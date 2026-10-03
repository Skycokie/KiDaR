import { NextResponse } from "next/server";
import {
  planPublishJobs,
  resolveEffectiveArTransform,
  type JobType,
  type PipelineJob
} from "@kidar/core";
import { computeInputHash, jobInputHashForType, sha256Hex } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { findJobByInputHash } from "@/lib/appwrite/jobs";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";

type Context = { params: { projectId: string } };

function sourceRef(sourceImagePath: string | null) {
  if (!sourceImagePath) return null;
  return {
    fileId: sourceImagePath,
    checksum: sha256Hex(`appwrite:${APPWRITE_SOURCE_BUCKET}:${sourceImagePath}`)
  };
}

function publicOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function stepLabel(type: JobType, status: string | null, blocked: boolean): string {
  if (blocked) return "Waiting for earlier stage";
  if (!status) return "Not started";
  if (status === "queued") return "Queued";
  if (status === "running") return "Building";
  if (status === "done") return "Done";
  if (status === "error") return "Failed";
  return status;
}

function jobProgress(job: PipelineJob | null): number {
  if (!job) return 0;
  if (job.status === "done") return 100;
  if (job.status === "queued") return 5;
  if (job.status === "running") {
    return typeof job.result?.progress === "number" ? job.result.progress : 40;
  }
  return 0;
}

/**
 * Publish pipeline status for Studio.
 * Steps are sequential: page_render is blocked until mind_compile (and popout/figurine)
 * are done with the same inputHash.
 */
export async function GET(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let plan: ReturnType<typeof planPublishJobs> | null = null;
  let planError: string | null = null;
  const contentHash = computeInputHash({
    projectId: project.id,
    mode: project.mode,
    source: sourceRef(project.source_image_path),
    settings: project.settings
  });

  try {
    plan = planPublishJobs(
      {
        mode: project.mode,
        sourceImagePath: project.source_image_path,
        galleryModelUrl: project.settings?.galleryModelUrl,
        uploadModelUrl: project.settings?.uploadModelUrl,
        figurineModelUrl: project.settings?.figurineModelUrl,
        slug: project.slug,
        allowLocalOrigins: /localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_APP_URL ?? "")
      },
      contentHash
    );
  } catch (cause) {
    planError = cause instanceof Error ? cause.message : "Publish plan unavailable";
  }

  const pageRenderIdentity = {
    slug: project.slug,
    publicAppOrigin: publicOrigin(process.env.NEXT_PUBLIC_APP_URL),
    publicAssetOrigin: publicOrigin(process.env.R2_PUBLIC_BASE_URL),
    showWatermark: true,
    startTransform: resolveEffectiveArTransform(project.settings),
    arAnchorMode:
      project.settings?.scene?.arAnchorMode === "follow" ? ("follow" as const) : ("marker" as const)
  };

  const jobs: JobType[] = plan?.jobs ?? [];
  const steps = [];
  let priorDone = true;

  for (const type of jobs) {
    const inputHash = jobInputHashForType(type, contentHash, pageRenderIdentity);
    const job = await findJobByInputHash({
      projectId: project.id,
      type,
      inputHash
    });
    // findJobByInputHash already filters by hash. A missing job while prior is done
    // means "not started". A prior incomplete step blocks page_render.
    const blocked = type === "page_render" ? !priorDone : false;
    const status = job?.status ?? null;
    steps.push({
      type,
      status,
      blocked,
      progress: jobProgress(job),
      label: stepLabel(type, status, blocked),
      error: job?.lastError ?? null,
      inputHash
    });
    if (type !== "page_render") {
      priorDone = status === "done";
    }
  }

  const pageStep = steps.find((s) => s.type === "page_render");
  const settings = project.settings ?? {};
  const publicUrls = {
    html: typeof settings.publicHtmlUrl === "string" ? settings.publicHtmlUrl : null,
    qr: typeof settings.publicQrUrl === "string" ? settings.publicQrUrl : null,
    pdf: typeof settings.publicPdfUrl === "string" ? settings.publicPdfUrl : null,
    experience:
      typeof settings.publicExperienceUrl === "string" ? settings.publicExperienceUrl : null
  };

  const ready = Boolean(publicUrls.experience || publicUrls.html) && pageStep?.status === "done";
  const failed = steps.some((s) => s.status === "error");
  const active = steps.some((s) => s.status === "queued" || s.status === "running");

  return NextResponse.json({
    projectId: project.id,
    projectStatus: project.status,
    planError,
    phase: ready ? "ready" : failed ? "failed" : active ? "building" : "idle",
    steps,
    publicUrls,
    ready
  });
}
