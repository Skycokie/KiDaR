"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, Sparkles, X } from "lucide-react";
import { KIDAR_WORDMARK_LABEL, KidarWordmark } from "@/components/brand/kidar-wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import type { Locale } from "@/i18n/config";
import { hrefForLocale } from "@/i18n/locale";
import "@/components/brand/kidar-wordmark.css";
import "./site-header.css";

function barePath(pathname: string) {
  return pathname.replace(/^\/(ro|en)(?=\/|$)/, "") || "/";
}

export function SiteHeader({
  brandHref = "/studio",
  studioHref = "/studio-preview/personalizeaza",
  trailing,
  mobileExtra,
  locale = "ro",
  menuLabel = "Meniu",
  languageLabel = "Limbă"
}: {
  brandHref?: string;
  /** Studio workspace entry (preview prototype or hub). */
  studioHref?: string;
  /** Desktop-only actions (right side). */
  trailing?: ReactNode;
  /** Extra rows inside the mobile sheet (after Atelier / Studio). */
  mobileExtra?: ReactNode;
  locale?: Locale;
  menuLabel?: string;
  languageLabel?: string;
}) {
  const rawPathname = usePathname() ?? "";
  const pathLocale = rawPathname.match(/^\/(ro|en)(?=\/|$)/)?.[1] as Locale | undefined;
  const activeLocale = pathLocale ?? locale;
  const pathname = barePath(rawPathname);
  const atelierActive = pathname.startsWith("/creaza");
  const studioActive =
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname === "/studio-preview" ||
    pathname.startsWith("/studio-preview/");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="site-header__brand" href={hrefForLocale(brandHref, activeLocale)} aria-label={KIDAR_WORDMARK_LABEL}>
        <KidarWordmark variant="compact" labelled={false} />
      </Link>

      <nav className="site-header__nav" aria-label="Principal">
        <div className="site-header__pill" role="list">
          <Link
            role="listitem"
            href={hrefForLocale("/creaza", activeLocale)}
            className="site-header__link"
            aria-current={atelierActive ? "page" : undefined}
          >
            <Sparkles aria-hidden size={16} strokeWidth={1.75} />
            Atelier
          </Link>
          <Link
            role="listitem"
            href={hrefForLocale(studioHref, activeLocale)}
            className="site-header__link"
            aria-current={studioActive ? "page" : undefined}
          >
            <LayoutGrid aria-hidden size={16} strokeWidth={1.75} />
            Studio
          </Link>
        </div>
      </nav>

      <div className="site-header__actions">
        <Suspense fallback={null}>
          <LocaleSwitcher locale={activeLocale} label={languageLabel} />
        </Suspense>
        <button
          type="button"
          className="site-header__ghost site-header__menu-btn"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="site-header-sheet"
        >
          {menuOpen ? <X aria-hidden size={18} strokeWidth={1.75} /> : <Menu aria-hidden size={18} strokeWidth={1.75} />}
          <span>{menuLabel}</span>
        </button>
        {trailing}
      </div>

      {menuOpen ? (
        <div
          id="site-header-sheet"
          className="site-header__sheet is-open"
          role="dialog"
          aria-label={menuLabel}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("a, button")) setMenuOpen(false);
          }}
        >
          <Link
            href={hrefForLocale("/creaza", activeLocale)}
            className="site-header__sheet-link"
            aria-current={atelierActive ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Sparkles aria-hidden size={18} strokeWidth={1.75} />
            Atelier
          </Link>
          <Link
            href={hrefForLocale(studioHref, activeLocale)}
            className="site-header__sheet-link"
            aria-current={studioActive ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <LayoutGrid aria-hidden size={18} strokeWidth={1.75} />
            Studio
          </Link>
          {mobileExtra}
        </div>
      ) : null}
    </header>
  );
}
