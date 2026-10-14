import { NextResponse } from "next/server";
import { readFigureFeatureFlags, type JobType, type PipelineJob } from "@kidar/core";
import { jobInputHashForType } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { findJobByInputHash } from "@/lib/appwrite/jobs";
import {
  pageRenderIdentityFor,
  planProjectPublish,
  publishContentHash
} from "@/lib/publish-identity";

type Context = { params: { projectId: string } };

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
 * Publish pipeline status for Studio. Ready only when page_render for the
 * current inputs (including decor) is done and public URLs are recorded.
 */
export async function GET(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const contentHash = publishContentHash(project);
  let jobs: JobType[] = [];
  let planError: string | null = null;
  try {
    jobs = planProjectPublish(project, contentHash, process.env).jobs as JobType[];
  } catch (cause) {
    planError = cause instanceof Error ? cause.message : "Publish plan unavailable";
  }

  const pageRenderIdentity = pageRenderIdentityFor(project, process.env);
  const steps = [];
  for (const type of jobs) {
    const job = await findJobByInputHash({
      projectId: project.id,
      type,
      inputHash: jobInputHashForType(type, contentHash, pageRenderIdentity)
    });
    steps.push({
      type,
      status: job?.status ?? null,
      progress: jobProgress(job),
      error: job?.status === "error" ? "failed" : null
    });
  }

  const settings = project.settings ?? {};
  const pageStep = steps.find((s) => s.type === "page_render");
  const experienceUrl =
    typeof settings.publicExperienceUrl === "string" ? settings.publicExperienceUrl : null;
  const ready = Boolean(experienceUrl) && pageStep?.status === "done";
  const failed = steps.some((s) => s.status === "error");
  const active = steps.some((s) => s.status === "queued" || s.status === "running");

  return NextResponse.json(
    {
      projectId: project.id,
      publishEnabled: readFigureFeatureFlags(process.env).publish,
      planError,
      phase: ready ? "ready" : failed ? "failed" : active ? "building" : "idle",
      steps,
      publicUrls: {
        experience: ready ? experienceUrl : null,
        pdf: ready && typeof settings.publicPdfUrl === "string" ? settings.publicPdfUrl : null
      },
      qrPath: ready ? `/api/projects/${encodeURIComponent(project.id)}/qr` : null,
      ready
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
