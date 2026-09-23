import { redirect } from "next/navigation";

/** Legacy foto step — Atelier flow is now a single `/creaza` shell. */
export default function CreazaFotoRedirectPage() {
  redirect("/creaza");
}
