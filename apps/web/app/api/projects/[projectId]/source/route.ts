import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectSourcePath } from "@/lib/projects";

type Context = { params: { projectId: string } };
const allowedTypes = new Set(["image/png", "image/jpeg"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: Context) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  if (projectError || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Only PNG and JPG images are supported" }, { status: 415 });
  }
  if (file.size > maxBytes) return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 413 });

  const path = projectSourcePath(user.id, params.projectId);
  const { error: uploadError } = await supabase.storage
    .from("source-drawings")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: updatedProject, error: updateError } = await supabase
    .from("projects")
    .update({ source_image_path: path })
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: signed, error: signedError } = await supabase.storage
    .from("source-drawings")
    .createSignedUrl(path, 60 * 60);
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 });

  return NextResponse.json({ project: updatedProject, sourceUrl: signed.signedUrl });
}
