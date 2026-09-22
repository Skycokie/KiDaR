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
  title: "Studio · kidAR",
  description: "Lumile tale — Atelier editorial pentru surprize AR din desene."
};

export const dynamic = "force-dynamic";

function FontFrame({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}

async function StudioLive() {
  const [worldsResult, user] = await Promise.all([
    getStudioWorldsForCurrentUser(),
    getLoggedInUser()
  ]);
  const createHref = user ? "/creaza" : "/intra";
  return <StudioShell worldsResult={worldsResult} createHref={createHref} />;
}

export default function StudioPage() {
  return (
    <FontFrame>
      <noscript>
        <p className="studio-noscript" style={{ margin: "1rem", color: "#9aa3b5" }}>
          Activează JavaScript pentru Studio.
        </p>
      </noscript>
      <Suspense fallback={<StudioShell worldsResult={{ kind: "loading" }} createHref="/intra" />}>
        <StudioLive />
      </Suspense>
    </FontFrame>
  );
}
