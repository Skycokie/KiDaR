import { redirect } from "next/navigation";
import { DocumentLang } from "@/components/simple-creator/document-lang";
import { getLoggedInUser } from "@/lib/appwrite/client";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getLoggedInUser();
  if (user) redirect("/studio");
  return (
    <>
      <DocumentLang lang="ro" />
      {children}
    </>
  );
}
