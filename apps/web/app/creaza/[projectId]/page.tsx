import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";

export default async function CreazaSavedPage({
  params
}: {
  params: { projectId: string };
}) {
  const user = await getLoggedInUser();
  if (!user) redirect("/intra");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  return (
    <SimpleCreatorShell progress="Pasul 4 din 5">
      <h1>Am salvat alegerea ta.</h1>
      <p className="creaza-lead">Pregătirea experienței va fi disponibilă în pasul următor.</p>
      <div className="creaza-actions">
        <Link className="creaza-btn creaza-btn-primary" href="/creaza">
          Creează altă surpriză
        </Link>
        <Link className="creaza-btn creaza-btn-secondary" href={`/studio/${project.id}`}>
          Opțiuni avansate în Studio
        </Link>
      </div>
    </SimpleCreatorShell>
  );
}
