import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { KidarWordmark } from "@/components/brand/kidar-wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import "@/components/brand/kidar-wordmark.css";
import { DrawingScene, LandingDiscovery } from "@/components/landing/drawing-scene";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { hrefForLocale } from "@/i18n/locale";
import { getLoggedInUser } from "@/lib/appwrite/client";
import "@/components/landing/landing.css";

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
  const copy = getMessages(getRequestLocale()).landing;
  return {
    title: `kiDAR — ${copy.title.replace(/\.$/, "")}`,
    description: copy.description
  };
}

export default async function HomePage() {
  const locale = getRequestLocale();
  const copy = getMessages(locale).landing;
  const user = await getLoggedInUser();
  const discoverHref = hrefForLocale(user ? "/creaza" : "/intra", locale);
  const studioHref = hrefForLocale(user ? "/studio-preview/personalizeaza" : "/login", locale);
  const steps = [
    { title: copy.draw, body: copy.drawBody },
    { title: copy.photograph, body: copy.photographBody },
    { title: copy.discover, body: copy.discoverBody }
  ];

  return (
    <div className={`landing ${display.variable} ${body.variable}`} lang={locale}>
      <a className="landing-skip" href="#continut">
        {getMessages(locale).accessibility.skipToContent}
      </a>
      <main id="continut" className="landing-wrap">
        <header className="landing-masthead">
          <Suspense fallback={null}>
            <LocaleSwitcher locale={locale} label={getMessages(locale).accessibility.languageSelector} />
          </Suspense>
          <KidarWordmark />
        </header>
        <section className="landing-hero" aria-labelledby="home-title">
          <div className="landing-copy">
            <h1 id="home-title">{copy.title}</h1>
            <p className="landing-lead">{copy.description}</p>
            <div className="landing-actions">
              <Link className="landing-btn landing-btn--primary" href={discoverHref}>
                {copy.discoverCta}
              </Link>
              <Link className="landing-btn landing-btn--secondary" href={studioHref}>
                {copy.studioCta}
              </Link>
            </div>
            <p className="landing-credit">{copy.originalArtNote}</p>
          </div>
          <DrawingScene />
        </section>

        <section className="landing-process" aria-labelledby="process-title">
          <h2 id="process-title">{copy.processTitle}</h2>
          <ol className="landing-steps">
            {steps.map((step, index) => (
              <li className="landing-step" key={step.title}>
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <LandingDiscovery />
        </section>

        <section className="landing-close" aria-labelledby="close-title">
          <h2 id="close-title">{copy.closeTitle}</h2>
          <div className="landing-actions">
            <Link className="landing-btn landing-btn--primary" href={discoverHref}>
              {copy.enterCta}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
