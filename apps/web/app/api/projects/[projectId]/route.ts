import { NextResponse } from "next/server";
import { mergeSettings, type ProjectSettingsPatch } from "@kidar/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Context = { params: { projectId: string } };

export async function GET(_request: Request, { params }: Context) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  if (error || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let sourceUrl: string | null = null;
  const assetUrls: Record<string, string> = {};
  if (project.source_image_path) {
    const signed = await supabase.storage
      .from("source-drawings")
      .createSignedUrl(project.source_image_path, 60 * 15);
    sourceUrl = signed.data?.signedUrl ?? null;
  }

  const settings = project.settings ?? {};
  for (const [key, path] of Object.entries({
    uploadModelUrl: settings.uploadModelPath,
    logoUrl: settings.logoPath,
    soundUrl: settings.soundPath
  })) {
    if (typeof path !== "string") continue;
    const signed = await supabase.storage.from("project-assets").createSignedUrl(path, 60 * 15);
    if (signed.data?.signedUrl) assetUrls[key] = signed.data.signedUrl;
  }

  return NextResponse.json({ project, sourceUrl, assetUrls });
}

export async function PATCH(request: Request, { params }: Context) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    mode?: "popout" | "gallery" | "upload";
    settings?: ProjectSettingsPatch;
  };
  const name = body.name?.trim();
  if (!name && !body.settings && !body.mode) {
    return NextResponse.json({ error: "Project name or settings are required" }, { status: 400 });
  }

  if (body.settings) {
    const { data: existing, error: existingError } = await supabase
      .from("projects")
      .select("settings")
      .eq("id", params.projectId)
      .eq("owner", user.id)
      .single();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 404 });
    const settings = mergeSettings(
      existing.settings,
      body.settings
    );
    const { data, error } = await supabase
      .from("projects")
      .update({ ...(name ? { name } : {}), ...(body.mode ? { mode: body.mode } : {}), settings })
      .eq("id", params.projectId)
      .eq("owner", user.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ ...(name ? { name } : {}), ...(body.mode ? { mode: body.mode } : {}) })
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_request: Request, { params }: Context) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, source_image_path, settings")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 404 });

  const paths = [project.source_image_path].filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("source-drawings").remove(paths);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  }
  const assetPaths = [
    project.settings?.uploadModelPath,
    project.settings?.logoPath,
    project.settings?.soundPath
  ].filter((path): path is string => Boolean(path));
  if (assetPaths.length) {
    const { error: assetError } = await supabase.storage.from("project-assets").remove(assetPaths);
    if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.projectId)
    .eq("owner", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
