import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProfile, getProjectForOwner, updateProjectDocument } from "@/lib/appwrite/db";
import { createSignedAssetUrl, uploadProjectAsset } from "@/lib/appwrite/storage";

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
    const key = kind === "model" ? "uploadModelPath" : kind === "logo" ? "logoPath" : "soundPath";
    const settings = { ...project.settings, [key]: path };
    await updateProjectDocument(params.projectId, { settings });
    const url = await createSignedAssetUrl(path, 60 * 15);
    return NextResponse.json({ path, url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
