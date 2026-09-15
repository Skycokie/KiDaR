import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.projectId)
    .eq("owner", user.id)
    .single();
  if (projectError || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      project_id: body.projectId,
      step: "popout_build",
      status: "queued",
      payload: { source: "studio" }
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("projects")
    .update({ status: "processing" })
    .eq("id", body.projectId)
    .eq("owner", user.id);

  return NextResponse.json({ job, message: "Publish queued. The worker pipeline will process it." }, { status: 202 });
}
