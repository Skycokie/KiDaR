import { redirect, notFound } from "next/navigation";
import { StudioClient } from "./studio-client";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProfile, getProjectForOwner } from "@/lib/appwrite/db";
import { createSignedAssetUrl, createSignedSourceUrl } from "@/lib/appwrite/storage";

export default async function StudioPage({
  params
}: {
  params: { projectId: string };
}) {
  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  let sourceUrl: string | null = null;
  if (project.source_image_path) {
    sourceUrl = await createSignedSourceUrl(project.source_image_path, 60 * 15);
  }

  const settings = project.settings ?? {};
  const assetUrls: Record<string, string> = {};
  for (const [key, path] of Object.entries({
    uploadModelUrl: settings.uploadModelPath,
    logoUrl: settings.logoPath,
    soundUrl: settings.soundPath
  })) {
    if (typeof path !== "string") continue;
    assetUrls[key] = await createSignedAssetUrl(path, 60 * 15);
  }

  const profile = await getProfile(user.$id);

  return (
    <StudioClient
      project={project}
      sourceUrl={sourceUrl}
      assetUrls={assetUrls}
      plan={profile.plan === "paid" ? "paid" : "free"}
    />
  );
}
