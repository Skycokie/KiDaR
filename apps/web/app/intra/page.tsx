import { redirect } from "next/navigation";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { IntraForm } from "./intra-form";

export default async function IntraPage() {
  const user = await getLoggedInUser();
  if (user) redirect("/creaza");

  return (
    <SimpleCreatorShell>
      <h1>Intră în kidAR</h1>
      <p className="creaza-lead">Folosești doar adresa de email. Fără parolă.</p>
      <IntraForm />
    </SimpleCreatorShell>
  );
}
