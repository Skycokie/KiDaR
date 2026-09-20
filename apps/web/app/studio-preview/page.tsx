import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DM_Sans, IBM_Plex_Mono, Syne } from "next/font/google";
import { StudioShell } from "@/components/studio-preview";
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

export const metadata: Metadata = {
  title: "kidAR Studio preview",
  description:
    "Editorial Studio shell. Signed-in users see their own worlds read-only; guests see local fixtures."
};

export const dynamic = "force-dynamic";

function FontFrame({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}

async function StudioPreviewLive() {
  const [worldsResult, user] = await Promise.all([
    getStudioWorldsForCurrentUser(),
    getLoggedInUser()
  ]);
  /** Same entry rule as marketing home: signed-in → /creaza, guest → /intra. */
  const createHref = user ? "/creaza" : "/intra";
  return <StudioShell worldsResult={worldsResult} createHref={createHref} />;
}

export default function StudioPreviewPage() {
  return (
    <FontFrame>
      <noscript>
        <p className="studio-noscript" style={{ margin: "1rem", color: "#9aa3b5" }}>
          Activează JavaScript pentru Studio. Gestionarea proiectelor rămâne pe /dashboard când ești
          autentificat.
        </p>
      </noscript>
      <Suspense fallback={<StudioShell worldsResult={{ kind: "loading" }} createHref="/intra" />}>
        <StudioPreviewLive />
      </Suspense>
    </FontFrame>
  );
}
