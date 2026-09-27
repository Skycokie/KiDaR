import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DM_Sans, IBM_Plex_Mono, Syne } from "next/font/google";
import { StudioShell } from "@/components/studio-preview";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { hrefForLocale } from "@/i18n/locale";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getStudioWorldsForCurrentUser } from "@/lib/studio-worlds.server";

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

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-studio-mono",
  display: "swap"
});

export function generateMetadata(): Metadata {
  return {
    title: "Studio · kidAR",
    description: getMessages(getRequestLocale()).worlds.metaDescription
  };
}

export const dynamic = "force-dynamic";

function FontFrame({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}

async function StudioLive({ locale }: { locale: Locale }) {
  const [worldsResult, user] = await Promise.all([
    getStudioWorldsForCurrentUser(locale),
    getLoggedInUser()
  ]);
  const createHref = hrefForLocale(user ? "/creaza" : "/intra", locale);
  return <StudioShell worldsResult={worldsResult} createHref={createHref} locale={locale} />;
}

export default function StudioPage() {
  const locale = getRequestLocale();
  const t = getMessages(locale).worlds;
  return (
    <FontFrame>
      <noscript>
        <p className="studio-noscript" style={{ margin: "1rem", color: "#9aa3b5" }}>
          {t.noscript}
        </p>
      </noscript>
      <Suspense
        fallback={
          <StudioShell
            worldsResult={{ kind: "loading" }}
            createHref={hrefForLocale("/intra", locale)}
            locale={locale}
          />
        }
      >
        <StudioLive locale={locale} />
      </Suspense>
    </FontFrame>
  );
}
