import { Suspense, type ReactNode } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { KidarWordmark } from "@/components/brand/kidar-wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import type { Locale } from "@/i18n/config";
import "@/components/brand/kidar-wordmark.css";
import "./auth-shell.css";

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

export function AuthShell({
  title,
  children,
  lang = "ro",
  locale = "ro",
  switcherLabel = "Limbă"
}: {
  title: string;
  children: ReactNode;
  lang?: Locale;
  locale?: Locale;
  switcherLabel?: string;
}) {
  return (
    <main className={`auth-shell ${display.variable} ${body.variable}`} lang={lang}>
      <section className="auth-card">
        <Suspense fallback={null}>
          <LocaleSwitcher locale={locale} label={switcherLabel} />
        </Suspense>
        <div className="auth-brand">
          <KidarWordmark />
        </div>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
