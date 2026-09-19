import { notFound, redirect } from "next/navigation";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { CreazaFotoForm } from "./foto-form";

export default async function CreazaFotoPage({
  params
}: {
  params: { projectId: string };
}) {
  const user = await getLoggedInUser();
  if (!user) redirect("/intra");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  return (
    <SimpleCreatorShell progress="Pasul 2 din 5">
      <h1>Fotografiază pagina</h1>
      <CreazaFotoForm projectId={project.id} />
    </SimpleCreatorShell>
  );
}
