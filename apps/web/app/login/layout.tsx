import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/appwrite/client";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getLoggedInUser();
  if (user) redirect("/studio");
  return children;
}
