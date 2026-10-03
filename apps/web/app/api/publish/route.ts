import { NextResponse } from "next/server";
import {
  PublicStorageConfigError,
  PublishPlanError,
  decideFigurePublish,
  publishLifecycleFromProjectStatus,
  readFigureFeatureFlags,
  createPublicArtifactStorage,
  type JobType
} from "@kidar/core";
import { jobInputHashForType } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob } from "@/lib/appwrite/jobs";
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
    createPublicArtifactStorage(process.env);

    const inputHash = publishContentHash(project);
    const plan = planProjectPublish(project, inputHash, process.env);
    const pageRenderIdentity = pageRenderIdentityFor(project, process.env);

    await updateProjectDocument(project.id, {
      settings: { ...project.settings, publishTermsAcceptedAt: new Date().toISOString() }
    });

    const jobs = [];
    let anyActive = false;
    for (const type of plan.jobs as JobType[]) {
      const enqueued = await enqueueJob({
        projectId: project.id,
        type,
        inputHash: jobInputHashForType(type, inputHash, pageRenderIdentity),
        ownerId: user.$id,
        payload: {
          source: "studio",
          dependsOn: type === "page_render" ? plan.dependsOn : undefined
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
