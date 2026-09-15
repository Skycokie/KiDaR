import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createProjectWithUniqueSlug } from "@/lib/projects";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { name?: string; mode?: "popout" | "gallery" | "upload" };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

  const { count, error: countError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner", user.id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const quota = profile.plan === "paid" ? 30 : 3;
  if ((count ?? 0) >= quota) {
    return NextResponse.json(
      { error: "quota_exceeded", message: "Free plan allows 3 projects.", upgrade: true },
      { status: 403 }
    );
  }

  const { data, error } = await createProjectWithUniqueSlug(
    supabase,
    user.id,
    name,
    body.mode ?? "popout"
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data }, { status: 201 });
}
