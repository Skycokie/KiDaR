import { redirect } from "next/navigation";
import { DocumentLang } from "@/components/simple-creator/document-lang";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { IntraForm } from "./intra-form";

export default async function IntraPage() {
  const user = await getLoggedInUser();
  if (user) redirect("/creaza");
  const locale = getRequestLocale();

  return (
    <>
      <DocumentLang lang={locale} />
      <IntraForm locale={locale} messages={getMessages(locale)} />
    </>
  );
}
