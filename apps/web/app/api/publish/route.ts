import { NextResponse } from "next/server";
import {
  PublicStorageConfigError,
  PublishPlanError,
  decideFigurePublish,
  publishLifecycleFromProjectStatus,
  readFigureFeatureFlags,
  createPublicArtifactStorage,
  publishStorageEnv,
  type JobType,
  type PipelineJob
} from "@kidar/core";
import { jobInputHashForType } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob, listProjectJobsWindow } from "@/lib/appwrite/jobs";
import { FIGURINE_COST_UNVERIFIED_BODY, verifyFigurineCost } from "@/lib/figurine-cost";
import { selectReusableFigurineBuild } from "@/lib/figurine-reuse";
import {
  pageRenderIdentityFor,
  planProjectPublish,
  publishContentHash
} from "@/lib/publish-identity";

const DENIED_STATUS: Record<string, number> = {
  flag_off: 403,
  not_allowlisted: 403,
  unauthorized: 403,
  terms: 403,
  limits: 429,
  not_ready: 409
};

export async function POST(request: Request) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    acceptTerms?: unknown;
  };
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const project = await getProjectForOwner(body.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const publish = decideFigurePublish({
    flags: readFigureFeatureFlags(process.env),
    requesterId: user.$id,
    ownerId: project.owner,
    allowlisted: true,
    status: publishLifecycleFromProjectStatus(project.status),
    withinLimits: true,
    termsAccepted: body.acceptTerms === true
  });
  if (!publish.allowed) {
    return NextResponse.json(
      { error: "publish_denied", code: publish.code },
      { status: DENIED_STATUS[publish.code] ?? 403 }
    );
  }

  try {
    const storage = createPublicArtifactStorage(publishStorageEnv(process.env));

    const inputHash = publishContentHash(project);
    const plan = planProjectPublish(project, inputHash, process.env);
    const pageRenderIdentity = pageRenderIdentityFor(project, process.env);

    let jobTypes = plan.jobs as JobType[];
    let dependsOn = plan.dependsOn;
    let reusedFigurine: PipelineJob | null = null;

    // Cost gate: publishing must never create a new `figurine_build` (paid Tripo) while the
    // cost is unverified. The only way through is to reuse a finished model the server can
    // prove belongs to this project, its current source and the accepted pipeline (see
    // lib/figurine-reuse.ts). Then no figurine_build is enqueued and page_render depends on
    // that exact job's hash. Everything here is read-only and runs before every write and
    // enqueue; nothing from the request or from owner-writable settings is authority.
    if (jobTypes.includes("figurine_build") && verifyFigurineCost().status !== "verified") {
      reusedFigurine = selectReusableFigurineBuild({
        project,
        windowJobs: await listProjectJobsWindow(project.id),
        publicUrlForKey: (key) => storage.getPublicUrl(key)
      });
      if (!reusedFigurine) {
        return NextResponse.json(FIGURINE_COST_UNVERIFIED_BODY, { status: 409 });
      }
      jobTypes = jobTypes.filter((type) => type !== "figurine_build");
      dependsOn = { ...plan.dependsOn, figurine_build: reusedFigurine.inputHash };
    }

    await updateProjectDocument(project.id, {
      settings: { ...project.settings, publishTermsAcceptedAt: new Date().toISOString() }
    });

    const jobs: Array<{ type: JobType; enqueue: string; job: PipelineJob }> = [];
    if (reusedFigurine) {
      jobs.push({ type: "figurine_build", enqueue: "reused", job: reusedFigurine });
    }
    let anyActive = false;
    for (const type of jobTypes) {
      const enqueued = await enqueueJob({
        projectId: project.id,
        type,
        inputHash: jobInputHashForType(type, inputHash, pageRenderIdentity),
        ownerId: user.$id,
        payload: {
          source: "studio",
          dependsOn: type === "page_render" ? dependsOn : undefined
        }
      });
      jobs.push({ type, enqueue: enqueued.kind, job: enqueued.job });
      if (enqueued.kind !== "idempotent_done") anyActive = true;
    }

    await updateProjectDocument(project.id, { status: anyActive ? "processing" : "ready" });

    return NextResponse.json(
      {
        jobs,
        enqueue: anyActive ? "queued" : "idempotent_done",
        message: anyActive
          ? "Publish queued. The worker will build public artifacts after each stage verifies."
          : "Publish inputs unchanged; existing public artifacts remain."
      },
      { status: 202 }
    );
  } catch (cause) {
    if (cause instanceof PublishPlanError) {
      return NextResponse.json({ error: cause.message, code: cause.code }, { status: cause.status });
    }
    if (cause instanceof PublicStorageConfigError) {
      return NextResponse.json({ error: cause.message, code: cause.code }, { status: 503 });
    }
    const message = cause instanceof Error ? cause.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
