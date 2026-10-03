import { NextResponse } from "next/server";
import {
  PublicStorageConfigError,
  PublishPlanError,
  decideFigurePublish,
  publishAllowlisted,
  publishLifecycleFromProjectStatus,
  readFigureFeatureFlags,
  createPublicArtifactStorage,
  planPublishJobs,
  resolveEffectiveArTransform,
  UploadModelError,
  type JobType
} from "@kidar/core";
import { computeInputHash, jobInputHashForType, sha256Hex } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import {
  acceptPublishTerms,
  countProjectsForOwner,
  getProfile,
  getProjectForOwner,
  updateProjectDocument
} from "@/lib/appwrite/db";
import { enqueueJob } from "@/lib/appwrite/jobs";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";
import { downloadProjectAssetBytes } from "@/lib/appwrite/storage";
import { isQuotaBypassEnabled, projectQuotaLimit } from "@/lib/quota";
import { promoteUploadModelToPublic } from "@/lib/promote-upload-model";

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

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    acceptTerms?: boolean;
  };
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const project = await getProjectForOwner(body.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let profile = await getProfile(user.$id);
  if (!profile.terms_accepted_at) {
    if (body.acceptTerms !== true) {
      return NextResponse.json(
        {
          error: "publish_denied",
          code: "terms",
          message: "Accept publish terms to continue."
        },
        { status: 403 }
      );
    }
    profile = await acceptPublishTerms(user.$id);
  }

  const used = await countProjectsForOwner(user.$id);
  const plan = profile.plan === "paid" ? "paid" : "free";
  const withinLimits = isQuotaBypassEnabled() || used <= projectQuotaLimit(plan);

  const publish = decideFigurePublish({
    flags: readFigureFeatureFlags(process.env),
    requesterId: user.$id,
    ownerId: user.$id,
    allowlisted: publishAllowlisted(process.env, user.$id),
    status: publishLifecycleFromProjectStatus(project.status),
    withinLimits,
    termsAccepted: Boolean(profile.terms_accepted_at)
  });
  if (!publish.allowed) {
    return NextResponse.json({ error: "publish_denied", code: publish.code }, { status: 403 });
  }

  try {
    createPublicArtifactStorage(process.env);

    let uploadModelUrl = project.settings?.uploadModelUrl ?? null;
    if (project.mode === "upload" && project.settings?.uploadModelPath && !uploadModelUrl) {
      const bytes = await downloadProjectAssetBytes(project.settings.uploadModelPath);
      if (!bytes?.byteLength) {
        return NextResponse.json(
          { error: "Uploaded model bytes are missing", code: "MISSING_UPLOAD_MODEL" },
          { status: 400 }
        );
      }
      try {
        const promoted = await promoteUploadModelToPublic({
          projectId: project.id,
          bytes
        });
        uploadModelUrl = promoted.publicUrl;
        await updateProjectDocument(body.projectId, {
          settings: { ...project.settings, uploadModelUrl }
        });
        project.settings = { ...project.settings, uploadModelUrl };
      } catch (promoteError) {
        if (promoteError instanceof UploadModelError) {
          return NextResponse.json(
            { error: promoteError.message, code: promoteError.code },
            { status: 400 }
          );
        }
        throw promoteError;
      }
    }

    const inputHash = computeInputHash({
      projectId: project.id,
      mode: project.mode,
      source: sourceRef(project.source_image_path),
      settings: project.settings
    });
    const planJobs = planPublishJobs(
      {
        mode: project.mode,
        sourceImagePath: project.source_image_path,
        galleryModelUrl: project.settings?.galleryModelUrl,
        uploadModelUrl,
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
      startTransform: resolveEffectiveArTransform(project.settings),
      arAnchorMode:
        project.settings?.scene?.arAnchorMode === "follow" ? ("follow" as const) : ("marker" as const),
      decor: project.settings?.scene?.decor ?? null
    };

    const jobs = [];
    let anyActive = false;
    for (const type of planJobs.jobs as JobType[]) {
      const enqueued = await enqueueJob({
        projectId: project.id,
        type,
        inputHash: jobInputHashForType(type, inputHash, pageRenderIdentity),
        ownerId: user.$id,
        payload: {
          source: "studio",
          dependsOn: type === "page_render" ? planJobs.dependsOn : undefined
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
