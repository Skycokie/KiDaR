import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Context = { params: { projectId: string } };

export async function PATCH(request: Request, { params }: Context) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .update({ name })
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
    .select("id, source_image_path")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 404 });

  const paths = [project.source_image_path].filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("source-drawings").remove(paths);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.projectId)
    .eq("owner", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
