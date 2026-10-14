import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { StudioI18nProvider } from "@/components/i18n/studio-i18n";
import { CameraArPreviewShell } from "@/components/studio-personalize-preview";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";

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

export async function generateMetadata(): Promise<Metadata> {
  const t = getMessages(getRequestLocale()).cameraAr;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default function StudioCameraArPreviewPage() {
  const locale = getRequestLocale();
  const t = getMessages(locale).cameraAr;
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <noscript>
        <p style={{ margin: "1rem", color: "#9aa3b5" }}>{t.noscript}</p>
      </noscript>
      <StudioI18nProvider locale={locale}>
        <CameraArPreviewShell />
      </StudioI18nProvider>
    </div>
  );
}
