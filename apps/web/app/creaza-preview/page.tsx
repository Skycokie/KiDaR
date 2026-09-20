import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { CreazaPreviewShell } from "@/components/creaza-preview";

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
  title: "kidAR Creează preview",
  description:
    "Static-first visual redesign of Simple Creator. Fixtures only — no upload, create, or publish."
};

export default function CreazaPreviewPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <noscript>
        <p style={{ margin: "1rem", color: "#9aa3b5" }}>
          Activează JavaScript pentru previzualizarea ritualului de creare. Fluxul real rămâne pe
          /creaza.
        </p>
      </noscript>
      <CreazaPreviewShell />
    </div>
  );
}
