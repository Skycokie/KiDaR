import { NextResponse } from "next/server";
import { mergeSettings, validateSceneSettingsPatch, type ProjectSettingsPatch } from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import {
  deleteProjectDocument,
  getProjectForOwner,
  updateProjectDocument
} from "@/lib/appwrite/db";
import {
  APPWRITE_ASSETS_BUCKET,
  APPWRITE_SOURCE_BUCKET,
  createSignedAssetUrl,
  createSignedSourceUrl,
  deleteStorageFiles
} from "@/lib/appwrite/storage";

type Context = { params: { projectId: string } };

/** Written only by publish / page_render on the server. */
const SERVER_OWNED_SETTINGS = [
  "publicHtmlUrl",
  "publicQrUrl",
  "publicPdfUrl",
  "publicExperienceUrl",
  "publishTermsAcceptedAt"
] as const;

export async function GET(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let sourceUrl: string | null = null;
  const assetUrls: Record<string, string> = {};
  if (project.source_image_path) {
    sourceUrl = await createSignedSourceUrl(project.source_image_path, 60 * 15);
  }

  const settings = project.settings ?? {};
  for (const [key, path] of Object.entries({
    uploadModelUrl: settings.uploadModelPath,
    logoUrl: settings.logoPath,
    soundUrl: settings.soundPath
  })) {
    if (typeof path !== "string") continue;
    assetUrls[key] = await createSignedAssetUrl(path, 60 * 15);
  }

  return NextResponse.json({ project, sourceUrl, assetUrls });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    mode?: "popout" | "gallery" | "upload" | "figurine_3d";
    settings?: ProjectSettingsPatch;
  };
  const name = body.name?.trim();
  if (!name && !body.settings && !body.mode) {
    return NextResponse.json({ error: "Project name or settings are required" }, { status: 400 });
  }

  const existing = await getProjectForOwner(params.projectId, user.$id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (body.settings && Object.prototype.hasOwnProperty.call(body.settings, "scene")) {
    const sceneError = validateSceneSettingsPatch(body.settings.scene);
    if (sceneError) return NextResponse.json({ error: sceneError }, { status: 400 });
  }

  try {
    const patch: Record<string, unknown> = {
      ...(name ? { name } : {}),
      ...(body.mode ? { mode: body.mode } : {})
    };
    if (body.settings) {
      const clientSettings = { ...body.settings };
      for (const key of SERVER_OWNED_SETTINGS) delete clientSettings[key];
      patch.settings = mergeSettings(existing.settings, clientSettings);
    }
    const project = await updateProjectDocument(params.projectId, patch);
    return NextResponse.json({ project });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const sourceIds = [project.source_image_path].filter((path): path is string => Boolean(path));
  if (sourceIds.length) await deleteStorageFiles(APPWRITE_SOURCE_BUCKET, sourceIds);

  const assetIds = [
    project.settings?.uploadModelPath,
    project.settings?.logoPath,
    project.settings?.soundPath
  ].filter((path): path is string => Boolean(path));
  if (assetIds.length) await deleteStorageFiles(APPWRITE_ASSETS_BUCKET, assetIds);

  try {
    await deleteProjectDocument(params.projectId);
    return new NextResponse(null, { status: 204 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
