import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { KidarWordmark } from "@/components/brand/kidar-wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { hrefForLocale } from "@/i18n/locale";
import {
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR,
  legalContactEmail,
  type LegalDocumentId
} from "@/lib/legal";
import { LEGAL_DOCS, LEGAL_OPERATOR_LABELS } from "./legal-copy";
import { LegalFooter } from "./legal-footer";
import "@/components/brand/kidar-wordmark.css";
import "./legal.css";

const display = Syne({ subsets: ["latin"], variable: "--font-studio-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-studio-body", display: "swap" });

export function legalMetadata(id: LegalDocumentId): Metadata {
  const doc = LEGAL_DOCS[getRequestLocale()][id];
  return { title: `${doc.title} · kidAR`, description: doc.intro };
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );
}

export function LegalPage({ id }: { id: LegalDocumentId }) {
  const locale = getRequestLocale();
  const copy = getMessages(locale);
  const doc = LEGAL_DOCS[locale][id];
  const labels = LEGAL_OPERATOR_LABELS[locale];
  const email = legalContactEmail();

  return (
    <div className={`legal ${display.variable} ${body.variable}`} lang={locale}>
      <main className="legal-wrap">
        <header className="legal-masthead">
          <Suspense fallback={null}>
            <LocaleSwitcher locale={locale} label={copy.accessibility.languageSelector} />
          </Suspense>
          <KidarWordmark />
        </header>

        <Link className="legal-back" href={hrefForLocale("/", locale)}>
          ← {copy.legal.backHome}
        </Link>

        <h1>{doc.title}</h1>
        <p className="legal-updated">
          {copy.legal.lastUpdated}: {formatDate(LEGAL_LAST_UPDATED, locale)}
        </p>
        <p className="legal-intro">{doc.intro}</p>

        <section className="legal-operator" aria-labelledby="legal-operator-title">
          <h2 id="legal-operator-title">{labels.controller}</h2>
          <dl>
            <dt>{labels.company}</dt>
            <dd>{LEGAL_OPERATOR.name}</dd>
            <dt>{labels.companyId}</dt>
            <dd>{LEGAL_OPERATOR.companyId}</dd>
            <dt>{labels.address}</dt>
            <dd>{LEGAL_OPERATOR.addressLines.join(", ")}</dd>
            <dt>{labels.contact}</dt>
            <dd>{email ? <a href={`mailto:${email}`}>{email}</a> : labels.contactFallback}</dd>
          </dl>
        </section>

        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
            {section.bullets ? (
              <ul>
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            ) : null}
            {section.table ? (
              <div className="legal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {section.table.head.map((cell) => (
                        <th key={cell} scope="col">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row) => (
                      <tr key={row.join("|")}>
                        {row.map((cell) => (
                          <td key={cell}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}

        <LegalFooter locale={locale} />
      </main>
    </div>
  );
}
