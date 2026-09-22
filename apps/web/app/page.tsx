import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { getLoggedInUser } from "@/lib/appwrite/client";
import "./home-page.css";

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
  title: "kidAR — desenele prind viață",
  description:
    "Fotografiază un desen sau o pagină. Transformă-l într-o experiență 3D pe care copilul o poate explora pe telefon."
};

export default async function HomePage() {
  const user = await getLoggedInUser();
  const atelierHref = user ? "/creaza" : "/intra";
  const studioHref = user ? "/studio-preview/personalizeaza" : "/login";

  return (
    <div className={`home-page ${display.variable} ${body.variable}`} lang="ro">
      <a className="home-page__skip" href="#continut">
        Sari la conținut
      </a>

      <main id="continut" className="home-page__frame">
        <p className="home-page__brand">kidAR · povești care ies din pagină</p>

        <section className="home-page__hero" aria-labelledby="home-title">
          <h1 id="home-title" className="home-page__title">
            Desenele prind viață.
          </h1>
          <p className="home-page__lead">
            Fotografiază un desen sau o pagină. Transformă-l într-o experiență 3D pe care copilul o
            poate explora direct pe telefon.
          </p>
          <div className="home-page__actions">
            <Link className="home-page__btn home-page__btn--primary" href={atelierHref}>
              Începe în Atelier
            </Link>
            <Link className="home-page__btn home-page__btn--secondary" href={studioHref}>
              Deschide Studio
            </Link>
          </div>
        </section>

        <ol className="home-page__steps" aria-label="Cum funcționează">
          <li>
            <em>1</em>
            <span>Fotografiază</span>
          </li>
          <li>
            <em>2</em>
            <span>Personalizează</span>
          </li>
          <li>
            <em>3</em>
            <span>Vezi în AR</span>
          </li>
        </ol>

        <p className="home-page__note">
          Fără aplicație de instalat. Deschizi linkul sau scanezi codul QR.
        </p>

        <div className="home-page__decor" aria-hidden="true">
          <div className="home-page__glow" />
          <div className="home-page__paper" />
        </div>
      </main>
    </div>
  );
}
