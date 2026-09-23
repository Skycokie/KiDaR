"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, Sparkles, X } from "lucide-react";
import "./site-header.css";

export function SiteHeader({
  brandHref = "/studio",
  studioHref = "/studio-preview/personalizeaza",
  trailing,
  mobileExtra
}: {
  brandHref?: string;
  /** Studio workspace entry (preview prototype or hub). */
  studioHref?: string;
  /** Desktop-only actions (right side). */
  trailing?: ReactNode;
  /** Extra rows inside the mobile sheet (after Atelier / Studio). */
  mobileExtra?: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const atelierActive = pathname.startsWith("/creaza");
  const studioActive =
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname === "/studio-preview" ||
    pathname.startsWith("/studio-preview/");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="site-header__brand" href={brandHref}>
        kidAR
      </Link>

      <nav className="site-header__nav" aria-label="Principal">
        <div className="site-header__pill" role="list">
          <Link
            role="listitem"
            href="/creaza"
            className="site-header__link"
            aria-current={atelierActive ? "page" : undefined}
          >
            <Sparkles aria-hidden size={16} strokeWidth={1.75} />
            Atelier
          </Link>
          <Link
            role="listitem"
            href={studioHref}
            className="site-header__link"
            aria-current={studioActive ? "page" : undefined}
          >
            <LayoutGrid aria-hidden size={16} strokeWidth={1.75} />
            Studio
          </Link>
        </div>
      </nav>

      <div className="site-header__actions">
        <button
          type="button"
          className="site-header__ghost site-header__menu-btn"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="site-header-sheet"
        >
          {menuOpen ? <X aria-hidden size={18} strokeWidth={1.75} /> : <Menu aria-hidden size={18} strokeWidth={1.75} />}
          <span>Meniu</span>
        </button>
        {trailing}
      </div>

      {menuOpen ? (
        <div
          id="site-header-sheet"
          className="site-header__sheet is-open"
          role="dialog"
          aria-label="Meniu"
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("a, button")) setMenuOpen(false);
          }}
        >
          <Link
            href="/creaza"
            className="site-header__sheet-link"
            aria-current={atelierActive ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Sparkles aria-hidden size={18} strokeWidth={1.75} />
            Atelier
          </Link>
          <Link
            href={studioHref}
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
