import { redirect } from "next/navigation";

/** Legacy preview URL — Studio hub now lives on `/studio`. */
export default function StudioPreviewRedirectPage() {
  redirect("/studio");
}
