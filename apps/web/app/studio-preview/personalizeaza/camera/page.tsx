import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { CameraArPreviewShell } from "@/components/studio-personalize-preview";

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
  title: "Cameră AR — previzualizare",
  description:
    "Static Cameră AR preview mock. Simulated states only — no device camera or tracking."
};

export default function StudioCameraArPreviewPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <noscript>
        <p style={{ margin: "1rem", color: "#9aa3b5" }}>
          Activează JavaScript pentru previzualizarea Cameră AR. Camera dispozitivului nu este
          folosită pe acest ecran.
        </p>
      </noscript>
      <CameraArPreviewShell />
    </div>
  );
}
