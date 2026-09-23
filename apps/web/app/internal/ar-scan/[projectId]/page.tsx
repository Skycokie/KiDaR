import { notFound, redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { isStagingRuntime } from "@/lib/staging-runtime";
import { ArScanClient } from "@/components/internal-ar/ar-scan-client";

export default async function InternalArScanPage({
  params
}: {
  params: { projectId: string };
}) {
  if (!isStagingRuntime()) notFound();

  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  return (
    <ArScanClient
      projectId={project.id}
      projectName={project.name}
      hasSource={Boolean(project.source_image_path)}
    />
  );
}
