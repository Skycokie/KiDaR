import { notFound, redirect } from "next/navigation";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { CreazaExperientaForm } from "./experienta-form";

export default async function CreazaExperientaPage({
  params
}: {
  params: { projectId: string };
}) {
  const user = await getLoggedInUser();
  if (!user) redirect("/intra");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  return (
    <SimpleCreatorShell progress="Pasul 3 din 5">
      <h1>Cum vrei să prindă viață?</h1>
      <CreazaExperientaForm
        projectId={project.id}
        preset={project.settings?.preset}
        initialMode={project.mode}
        initialCtaText={project.settings?.ctaText}
        initialGalleryUrl={project.settings?.galleryModelUrl}
      />
    </SimpleCreatorShell>
  );
}
