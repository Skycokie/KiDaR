import { redirect } from "next/navigation";
import { DocumentLang } from "@/components/simple-creator/document-lang";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { IntraForm } from "./intra-form";

export default async function IntraPage() {
  const user = await getLoggedInUser();
  if (user) redirect("/creaza");

  return (
    <>
      <DocumentLang lang="ro" />
      <IntraForm />
    </>
  );
}
