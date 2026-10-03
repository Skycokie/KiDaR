import { NextResponse } from "next/server";
import { UploadModelError, PublicStorageConfigError } from "@kidar/core";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProfile, getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { createSignedAssetUrl, uploadProjectAsset } from "@/lib/appwrite/storage";
import { promoteUploadModelToPublic } from "@/lib/promote-upload-model";

type Context = { params: { projectId: string } };
type AssetKind = "model" | "logo" | "sound";

const assetTypes: Record<AssetKind, Set<string>> = {
  model: new Set(["model/gltf-binary", "application/octet-stream"]),
  logo: new Set(["image/png", "image/jpeg", "image/svg+xml"]),
  sound: new Set(["audio/mpeg", "audio/mp3"])
};

const assetLimits: Record<AssetKind, number> = {
  model: 25 * 1024 * 1024,
  logo: 5 * 1024 * 1024,
  sound: 1 * 1024 * 1024
};

export async function POST(request: Request, { params }: Context) {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kindValue = formData.get("kind");
  if (!(file instanceof File) || typeof kindValue !== "string" || !(kindValue in assetTypes)) {
    return NextResponse.json({ error: "Valid asset file and kind are required" }, { status: 400 });
  }
  const kind = kindValue as AssetKind;
  if (kind === "logo") {
    const profile = await getProfile(user.$id);
    if (profile.plan !== "paid") {
      return NextResponse.json({ error: "Upgrade to the paid plan for logos" }, { status: 403 });
    }
  }
  if (!assetTypes[kind].has(file.type)) {
    return NextResponse.json({ error: `Unsupported ${kind} file type` }, { status: 415 });
  }
  if (file.size > assetLimits[kind]) {
    return NextResponse.json({ error: `${kind} file is too large` }, { status: 413 });
  }

  try {
    const path = await uploadProjectAsset(user.$id, params.projectId, kind, file);
    const settings: Record<string, unknown> = { ...project.settings };
    let publicModelUrl: string | null = null;

    if (kind === "model") {
      settings.uploadModelPath = path;
      const bytes = new Uint8Array(await file.arrayBuffer());
      try {
        const promoted = await promoteUploadModelToPublic({
          projectId: params.projectId,
          bytes
        });
        settings.uploadModelUrl = promoted.publicUrl;
        publicModelUrl = promoted.publicUrl;
      } catch (promoteError) {
        // Private path is still saved; publish can retry promote.
        if (
          !(promoteError instanceof PublicStorageConfigError) &&
          !(promoteError instanceof UploadModelError)
        ) {
          throw promoteError;
        }
      }
    } else if (kind === "logo") {
      settings.logoPath = path;
    } else {
      settings.soundPath = path;
    }

    const patch: { settings: typeof settings; mode?: "upload" } = { settings };
    if (kind === "model") patch.mode = "upload";
    await updateProjectDocument(params.projectId, patch);
    const url = await createSignedAssetUrl(path, 60 * 15);
    return NextResponse.json({
      path,
      url,
      uploadModelUrl: publicModelUrl,
      mode: kind === "model" ? "upload" : project.mode
    });
  } catch (cause) {
    if (cause instanceof UploadModelError) {
      return NextResponse.json({ error: cause.message, code: cause.code }, { status: 400 });
    }
    if (cause instanceof PublicStorageConfigError) {
      return NextResponse.json({ error: cause.message, code: cause.code }, { status: 503 });
    }
    const message = cause instanceof Error ? cause.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
