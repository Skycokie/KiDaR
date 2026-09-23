import { redirect } from "next/navigation";

/** Legacy English dashboard — Studio hub is now `/studio`. */
export default function DashboardRedirectPage() {
  redirect("/studio");
}
