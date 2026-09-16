import { NextResponse } from "next/server";
import { createPublicArtifactStorage, PublicStorageConfigError } from "@kidar/core";
import { computeInputHash, sha256Hex } from "@kidar/core/hash";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { enqueueJob } from "@/lib/appwrite/jobs";
import { APPWRITE_SOURCE_BUCKET } from "@/lib/appwrite/config";

/**
 * Source content checksum: prefer hashing file bytes in later milestones.
 * Until then, derive a stable identifier digest so inputHash stays deterministic
 * without reading private object bodies on enqueue.
 */
function sourceRef(sourceImagePath: string | null) {
  if (!sourceImagePath) return null;
  return {
    fileId: sourceImagePath,
    checksum: sha256Hex(`appwrite:${APPWRITE_SOURCE_BUCKET}:${sourceImagePath}`)
  };
}

export async function POST(request: Request) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const project = await getProjectForOwner(body.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    // Fail closed: publishing requires a valid public artifact store config.
    createPublicArtifactStorage(process.env);

    const inputHash = computeInputHash({
      projectId: project.id,
      mode: project.mode,
      source: sourceRef(project.source_image_path),
      settings: project.settings
    });

    const enqueued = await enqueueJob({
      projectId: project.id,
      type: "popout_build",
      inputHash,
      ownerId: user.$id,
      payload: { source: "studio" }
    });

    if (enqueued.kind !== "idempotent_done") {
      await updateProjectDocument(body.projectId, { status: "processing" });
    }

    return NextResponse.json(
      {
        job: enqueued.job,
        enqueue: enqueued.kind,
        message:
          enqueued.kind === "idempotent_done"
            ? "Publish inputs unchanged; returning existing completed job."
            : enqueued.kind === "existing"
              ? "Publish already queued or running for these inputs."
              : "Publish queued. The worker pipeline will process it."
      },
      { status: 202 }
    );
  } catch (cause) {
    if (cause instanceof PublicStorageConfigError) {
      return NextResponse.json({ error: cause.message, code: cause.code }, { status: 503 });
    }
    const message = cause instanceof Error ? cause.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
