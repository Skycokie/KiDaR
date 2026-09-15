import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("owner", user.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("plan").eq("id", user.id).single()
  ]);
  const plan = profile?.plan === "paid" ? "paid" : "free";
  const limit = plan === "paid" ? 30 : 3;

  return (
    <DashboardClient
      initialProjects={projects ?? []}
      initialQuota={{ plan, used: projects?.length ?? 0, limit, canCreate: (projects?.length ?? 0) < limit }}
    />
  );
}
