import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProjectForOwner } from "@/lib/appwrite/db";
import { CREATOR_PRESET_COPY, isSimpleCreatorPreset } from "@/lib/simple-creator";

export default async function CreazaSavedPage({
  params
}: {
  params: { projectId: string };
}) {
  const user = await getLoggedInUser();
  if (!user) redirect("/intra");

  const project = await getProjectForOwner(params.projectId, user.$id);
  if (!project) notFound();

  const preset = project.settings.preset;
  const label = isSimpleCreatorPreset(preset) ? CREATOR_PRESET_COPY[preset].title : "surpriza";

  return (
    <SimpleCreatorShell progress="Pasul 4 din 5">
      <h1>Am salvat alegerea ta</h1>
      <p className="creaza-lead">
        Ai ales: {label}. Pregătirea experienței va fi disponibilă în pasul următor. Nu am pregătit
        încă linkul pe telefon, codul QR sau trimiterea pe email.
      </p>
      <div className="creaza-actions">
        <Link className="creaza-btn creaza-btn-secondary" href={`/creaza/${project.id}/experienta`}>
          Înapoi
        </Link>
        <Link className="creaza-btn creaza-btn-secondary" href="/dashboard">
          Deschide Studio (English)
        </Link>
      </div>
    </SimpleCreatorShell>
  );
}
