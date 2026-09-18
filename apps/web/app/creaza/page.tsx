import { redirect } from "next/navigation";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { CreazaPresetForm } from "./creaza-preset-form";

export default async function CreazaPage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/intra");

  return (
    <SimpleCreatorShell progress="Pasul 1 din 5">
      <h1>Ce vrei să prindă viață?</h1>
      <p className="creaza-lead">
        Fotografiază o pagină. Copilul deschide un link pe telefon. Fără aplicație.
      </p>
      <CreazaPresetForm />
    </SimpleCreatorShell>
  );
}
