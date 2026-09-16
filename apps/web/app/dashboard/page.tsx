import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProfile, listProjectsForOwner } from "@/lib/appwrite/db";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  const [projects, profile] = await Promise.all([
    listProjectsForOwner(user.$id),
    getProfile(user.$id)
  ]);
  const plan = profile.plan === "paid" ? "paid" : "free";
  const limit = plan === "paid" ? 30 : 3;

  return (
    <DashboardClient
      initialProjects={projects}
      initialQuota={{ plan, used: projects.length, limit, canCreate: projects.length < limit }}
    />
  );
}
