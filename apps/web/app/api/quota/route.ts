import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ count, error: projectsError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner", user.id),
      supabase.from("profiles").select("plan").eq("id", user.id).single()
    ]);

  if (projectsError || profileError) {
    return NextResponse.json(
      { error: projectsError?.message ?? profileError?.message },
      { status: 500 }
    );
  }

  const plan = profile.plan === "paid" ? "paid" : "free";
  const limit = plan === "paid" ? 30 : 3;
  return NextResponse.json({
    plan,
    used: count ?? 0,
    limit,
    canCreate: (count ?? 0) < limit
  });
}
