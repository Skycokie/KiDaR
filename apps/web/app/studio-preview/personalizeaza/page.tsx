import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { PersonalizePreviewShell } from "@/components/studio-personalize-preview";

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
  title: "kidAR Studio — personalizează (preview)",
  description:
    "Static Studio personalize preview. Fixture world only — no save, camera, or real projects."
};

export default function StudioPersonalizePreviewPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <noscript>
        <p style={{ margin: "1rem", color: "#9aa3b5" }}>
          Activează JavaScript pentru previzualizarea Studio. Nu există salvare sau cameră pe acest
          ecran.
        </p>
      </noscript>
      <PersonalizePreviewShell />
    </div>
  );
}
