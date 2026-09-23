import { notFound, redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { isStagingRuntime } from "@/lib/staging-runtime";
import { InternalArClient } from "@/components/internal-ar/internal-ar-client";

export default async function InternalArPage({
  params
}: {
  params: { projectId: string };
}) {
  // Production must never serve this route. Asset URLs are fetched client-side
  // from /api/internal/figures/:id (presigned, no-store) — never baked into HTML.
  if (!isStagingRuntime()) notFound();

  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  return <InternalArClient projectId={project.id} projectName={project.name} />;
}
