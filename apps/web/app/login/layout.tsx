import { redirect } from "next/navigation";
import { DocumentLang } from "@/components/simple-creator/document-lang";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { getLoggedInUser } from "@/lib/appwrite/client";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getLoggedInUser();
  if (user) redirect("/studio");
  const locale = getRequestLocale();
  return (
    <>
      <DocumentLang lang={locale} />
      {children}
    </>
  );
}
