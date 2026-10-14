import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { redirect } from "next/navigation";
import { CreazaPreviewShell } from "@/components/creaza-preview";
import { StudioI18nProvider } from "@/components/i18n/studio-i18n";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { hrefForLocale } from "@/i18n/locale";
import { getLoggedInUser } from "@/lib/appwrite/client";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-studio-display",
  display: "swap"
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-studio-body",
  display: "swap"
});

export function generateMetadata(): Metadata {
  const t = getMessages(getRequestLocale()).creaza;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function CreazaPage() {
  const locale = getRequestLocale();
  const user = await getLoggedInUser();
  if (!user) redirect(hrefForLocale("/intra", locale));

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <StudioI18nProvider locale={locale}>
        <CreazaPreviewShell />
      </StudioI18nProvider>
    </div>
  );
}
