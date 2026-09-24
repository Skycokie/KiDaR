import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { DrawingScene, LandingRooster } from "@/components/landing/drawing-scene";
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

export const metadata: Metadata = {
  title: "kiDAR — Desenul tău prinde viață",
  description: "Transformă un desen într-o figurină pe care o poți descoperi în lumea ta."
};

const steps = [
  {
    title: "Desenează",
    body: "Creează un personaj în stilul tău."
  },
  {
    title: "Fotografiază",
    body: "Păstrează desenul clar, întreg și bine luminat."
  },
  {
    title: "Descoperă",
    body: "Privește figurina și exploreaz-o în spațiul tău."
  }
];

export default async function HomePage() {
  const user = await getLoggedInUser();
  const discoverHref = user ? "/creaza" : "/intra";
  const studioHref = user ? "/studio-preview/personalizeaza" : "/login";

  return (
    <div className={`landing ${display.variable} ${body.variable}`} lang="ro">
      <a className="landing-skip" href="#continut">
        Sari la conținut
      </a>
      <main id="continut" className="landing-wrap">
        <section className="landing-hero" aria-labelledby="home-title">
          <div className="landing-copy">
            <p className="landing-kicker">kiDAR</p>
            <h1 id="home-title">Desenul tău prinde viață.</h1>
            <p className="landing-lead">
              Transformă un desen într-o figurină pe care o poți descoperi în lumea ta.
            </p>
            <div className="landing-actions">
              <Link className="landing-btn landing-btn--primary" href={discoverHref}>
                Descoperă kiDAR
              </Link>
              <Link className="landing-btn landing-btn--secondary" href={studioHref}>
                Intră în Studio
              </Link>
            </div>
            <p className="landing-credit">Ilustrații originale create pentru kiDAR.</p>
          </div>
          <DrawingScene />
        </section>

        <section className="landing-process" aria-labelledby="process-title">
          <h2 id="process-title">Din desen, într-o lume nouă.</h2>
          <ol className="landing-steps">
            {steps.map((step, index) => (
              <li className="landing-step" key={step.title}>
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <LandingRooster />
        </section>

        <section className="landing-close" aria-labelledby="close-title">
          <h2 id="close-title">O idee mică poate deveni o lume mare.</h2>
          <div className="landing-actions">
            <Link className="landing-btn landing-btn--primary" href={discoverHref}>
              Intră în kiDAR
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
