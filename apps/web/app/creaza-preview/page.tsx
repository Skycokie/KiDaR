import { redirect } from "next/navigation";

/** Legacy preview URL — Atelier flow now lives on `/creaza`. */
export default function CreazaPreviewRedirectPage() {
  redirect("/creaza");
}
