import { NextResponse } from "next/server";
import {
  PublicStorageConfigError,
  PublishPlanError,
  createPublicArtifactStorage,
  planPublishJobs,
  resolveEffectiveArTransform,
  type JobType
} from "@kidar/core";
import { computeInputHash, jobInputHashForType, sha256Hex } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob } from "@/lib/appwrite/jobs";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";

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

export async function POST(request: Request) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const project = await getProjectForOwner(body.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    createPublicArtifactStorage(process.env);

    const inputHash = computeInputHash({
      projectId: project.id,
      mode: project.mode,
      source: sourceRef(project.source_image_path),
      settings: project.settings
    });
    const plan = planPublishJobs(
      {
        mode: project.mode,
        sourceImagePath: project.source_image_path,
        galleryModelUrl: project.settings?.galleryModelUrl,
        uploadModelUrl: project.settings?.uploadModelUrl,
        figurineModelUrl: project.settings?.figurineModelUrl,
        slug: project.slug,
        allowLocalOrigins: /localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_APP_URL ?? "")
      },
      inputHash
    );

    const pageRenderIdentity = {
      slug: project.slug,
      publicAppOrigin: publicOrigin(process.env.NEXT_PUBLIC_APP_URL),
      publicAssetOrigin: publicOrigin(process.env.R2_PUBLIC_BASE_URL),
      showWatermark: true,
      startTransform: resolveEffectiveArTransform(project.settings)
    };

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

    await updateProjectDocument(body.projectId, { status: anyActive ? "processing" : "ready" });

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
