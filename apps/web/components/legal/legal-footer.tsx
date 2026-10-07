import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { hrefForLocale } from "@/i18n/locale";
import { LEGAL_OPERATOR, LEGAL_PATHS } from "@/lib/legal";
import "./legal.css";

/** Legal links plus the operator name. Server component, no client JS. */
export function LegalFooter({ locale }: { locale: Locale }) {
  const copy = getMessages(locale).legal;
  return (
    <footer className="legal-footer">
      <nav aria-label={copy.footerLabel}>
        <Link href={hrefForLocale(LEGAL_PATHS.privacy, locale)}>{copy.privacy}</Link>
        <Link href={hrefForLocale(LEGAL_PATHS.terms, locale)}>{copy.terms}</Link>
        <Link href={hrefForLocale(LEGAL_PATHS.cookies, locale)}>{copy.cookies}</Link>
      </nav>
      <span>© {LEGAL_OPERATOR.name}</span>
    </footer>
  );
}
