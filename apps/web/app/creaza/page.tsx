import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { redirect } from "next/navigation";
import { CreazaPreviewShell } from "@/components/creaza-preview";
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

export const metadata: Metadata = {
  title: "Creează · kidAR",
  description: "Fotografiază un desen, alege scena, și fă pagina să prindă viață."
};

export default async function CreazaPage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/intra");

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <CreazaPreviewShell />
    </div>
  );
}
