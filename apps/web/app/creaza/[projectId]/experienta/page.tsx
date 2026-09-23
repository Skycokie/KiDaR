import { redirect } from "next/navigation";

/** Legacy experience step — Atelier flow is now a single `/creaza` shell. */
export default function CreazaExperientaRedirectPage() {
  redirect("/creaza");
}
