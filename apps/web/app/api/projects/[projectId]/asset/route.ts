import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kindValue = formData.get("kind");
  if (!(file instanceof File) || typeof kindValue !== "string" || !(kindValue in assetTypes)) {
    return NextResponse.json({ error: "Valid asset file and kind are required" }, { status: 400 });
  }
  const kind = kindValue as AssetKind;
  if (kind === "logo") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    if (profile?.plan !== "paid") {
      return NextResponse.json({ error: "Upgrade to the paid plan for logos" }, { status: 403 });
    }
  }
  if (!assetTypes[kind].has(file.type)) {
    return NextResponse.json({ error: `Unsupported ${kind} file type` }, { status: 415 });
  }
  if (file.size > assetLimits[kind]) {
    return NextResponse.json({ error: `${kind} file is too large` }, { status: 413 });
  }

  const extension = kind === "model" ? "glb" : kind === "sound" ? "mp3" : "png";
  const path = `${user.id}/${params.projectId}/${kind}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("project-assets")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const key = kind === "model" ? "uploadModelPath" : kind === "logo" ? "logoPath" : "soundPath";
  const { data: current } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  const settings = { ...(current?.settings ?? {}), [key]: path };
  const { error: updateError } = await supabase
    .from("projects")
    .update({ settings })
    .eq("id", params.projectId)
    .eq("owner", user.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: signed, error: signedError } = await supabase.storage
    .from("project-assets")
    .createSignedUrl(path, 60 * 15);
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 });

  return NextResponse.json({ path, url: signed.signedUrl });
}
