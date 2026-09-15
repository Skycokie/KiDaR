import { redirect, notFound } from "next/navigation";
import { StudioClient } from "./studio-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StudioPage({
  params
}: {
  params: { projectId: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.projectId)
    .eq("owner", user.id)
    .single();
  if (error || !project) notFound();

  let sourceUrl: string | null = null;
  if (project.source_image_path) {
    const signed = await supabase.storage
      .from("source-drawings")
      .createSignedUrl(project.source_image_path, 60 * 15);
    sourceUrl = signed.data?.signedUrl ?? null;
  }

  const settings = project.settings ?? {};
  const assetUrls: Record<string, string> = {};
  for (const [key, path] of Object.entries({
    uploadModelUrl: settings.uploadModelPath,
    logoUrl: settings.logoPath,
    soundUrl: settings.soundPath
  })) {
    if (typeof path !== "string") continue;
    const signed = await supabase.storage.from("project-assets").createSignedUrl(path, 60 * 15);
    if (signed.data?.signedUrl) assetUrls[key] = signed.data.signedUrl;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  return (
    <StudioClient
      project={project}
      sourceUrl={sourceUrl}
      assetUrls={assetUrls}
      plan={profile?.plan === "paid" ? "paid" : "free"}
    />
  );
}
