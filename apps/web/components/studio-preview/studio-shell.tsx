"use client";

import { useMemo, useState } from "react";
import {
  artKindFromId,
  fixtureStudioWorlds,
  type StudioWorldCard,
  type StudioWorldsResult
} from "@/lib/studio-worlds";
import { SiteHeader } from "@/components/site-nav";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { hrefForLocale } from "@/i18n/locale";
import type { Messages } from "@/i18n/types";
import { Artwork, HeroStage } from "./artworks";
import {
  CREATE_CHOICES,
  FIXTURE_ASSETS,
  FIXTURE_PROJECTS,
  LIBRARY_FILTERS,
  MOBILE_NAV,
  type FixtureAssetKind,
  type FixtureView
} from "./fixtures";
import "./studio-preview.css";

type WorldsCopy = Messages["worlds"];

function cropClass(variant: StudioWorldCard["visualVariant"]): string {
  if (variant === "landscape") return "panorama";
  return variant;
}

function WorldPosterArt({
  world,
  art
}: {
  world: StudioWorldCard;
  art: ReturnType<typeof resolveArt>;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const preview = world.preview?.kind === "safe-preview" ? world.preview : null;

  if (preview && failedSrc !== preview.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="studio-art"
        src={preview.src}
        alt={preview.alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(preview.src)}
      />
    );
  }
  return <Artwork id={`world-${world.id}`} kind={art} />;
}

function resolveArt(world: StudioWorldCard, sourceKind: StudioWorldsResult["kind"]) {
  if (sourceKind === "fixtures") {
    const fixture = FIXTURE_PROJECTS.find((item) => item.id === world.id);
    if (fixture) return fixture.art;
  }
  return artKindFromId(world.id);
}

export function StudioShell({
  worldsResult,
  createHref = "/intra",
  locale = "ro"
}: {
  worldsResult?: StudioWorldsResult;
  /** Existing Simple Creator entry — /creaza when signed in, /intra when guest. */
  createHref?: string;
  locale?: Locale;
}) {
  const messages = getMessages(locale);
  const t = messages.worlds;
  const result = worldsResult ?? { kind: "fixtures", worlds: fixtureStudioWorlds(locale) };
  const worlds = result.kind === "fixtures" || result.kind === "live" ? result.worlds : [];
  const [view, setView] = useState<FixtureView>("atelier");
  const [libraryFilter, setLibraryFilter] = useState<"all" | FixtureAssetKind>("all");
  const [selectedWorld, setSelectedWorld] = useState(worlds[0]?.id ?? "");

  const assets = useMemo(
    () =>
      libraryFilter === "all"
        ? FIXTURE_ASSETS
        : FIXTURE_ASSETS.filter((asset) => asset.kind === libraryFilter),
    [libraryFilter]
  );

  function go(next: FixtureView) {
    setView(next);
  }

  return (
    <div className="studio-preview">
      <a className="studio-skip" href="#studio-main">
        {messages.accessibility.skipToContent}
      </a>

      <SiteHeader
        brandHref="/studio"
        studioHref="/studio"
        locale={locale}
        menuLabel={messages.accessibility.menu}
        languageLabel={messages.accessibility.languageSelector}
        navLabel={t.nav.main}
        trailing={
          <>
            <button
              type="button"
              className="studio-header__ghost studio-header__secondary"
              aria-current={view === "worlds" ? "page" : undefined}
              onClick={() => go("worlds")}
            >
              {t.nav.worlds}
            </button>
            <button
              type="button"
              className="studio-header__ghost studio-header__secondary"
              aria-current={view === "library" ? "page" : undefined}
              onClick={() => go("library")}
            >
              {t.nav.library}
            </button>
            <button type="button" className="studio-header__ghost" disabled>
              {t.nav.profile}
            </button>
          </>
        }
        mobileExtra={
          <>
            <button
              type="button"
              className="site-header__sheet-btn"
              aria-current={view === "worlds" ? "page" : undefined}
              onClick={() => go("worlds")}
            >
              {t.nav.worlds}
            </button>
            <button
              type="button"
              className="site-header__sheet-btn"
              aria-current={view === "library" ? "page" : undefined}
              onClick={() => go("library")}
            >
              {t.nav.library}
            </button>
            <button
              type="button"
              className="site-header__sheet-btn"
              aria-current={view === "create" ? "page" : undefined}
              onClick={() => go("create")}
            >
              {t.nav.create}
            </button>
            <button type="button" className="site-header__sheet-btn" disabled>
              {t.nav.profile}
            </button>
          </>
        }
      />

      <main id="studio-main" className="studio-main">
        {view === "atelier" ? (
          <>
            <section className="atelier-hero" aria-labelledby="atelier-title">
              <div className="atelier-hero__copy">
                <p className="atelier-kicker">{t.atelier.kicker}</p>
                <h1 id="atelier-title" className="atelier-title">
                  {t.atelier.titleLine1}
                  <br />
                  {t.atelier.titleLine2}
                </h1>
                <p className="atelier-lead">{t.atelier.lead}</p>
                <div className="atelier-actions">
                  <a className="atelier-cta" href={createHref}>
                    {t.atelier.startWithPhoto}
                  </a>
                  <button type="button" className="atelier-secondary" onClick={() => go("worlds")}>
                    {t.atelier.seeWorlds}
                  </button>
                </div>
                <ol className="atelier-steps" aria-label={t.atelier.stepsLabel}>
                  <li>
                    <span>01</span> {t.atelier.stepPhoto}
                  </li>
                  <li>
                    <span>02</span> {t.atelier.stepWorld}
                  </li>
                  <li>
                    <span>03</span> {t.atelier.stepPhone}
                  </li>
                </ol>
              </div>
              <HeroStage
                label={t.atelier.heroLabel}
                playLabel={messages.landing.playAnimation}
                pauseLabel={messages.landing.pauseAnimation}
              />
            </section>

            <WorldsGallery
              t={t}
              result={result}
              selectedId={selectedWorld}
              onSelect={setSelectedWorld}
              createHref={createHref}
            />
          </>
        ) : null}

        {view === "worlds" ? (
          <WorldsGallery
            t={t}
            result={result}
            selectedId={selectedWorld}
            onSelect={setSelectedWorld}
            createHref={createHref}
            standalone
          />
        ) : null}

        {view === "create" ? <CreateView t={t} createHref={createHref} /> : null}

        {view === "library" ? (
          <LibraryView t={t} filter={libraryFilter} onFilter={setLibraryFilter} assets={assets} />
        ) : null}

        {view === "settings" ? (
          <section className="studio-quiet">
            <h1>{t.settings.title}</h1>
            <p>{t.settings.body}</p>
          </section>
        ) : null}
      </main>

      <nav className="studio-mobile-nav" aria-label={t.nav.mobile}>
        <a href={hrefForLocale("/creaza", locale)}>Atelier</a>
        <a href={hrefForLocale("/studio", locale)} aria-current="page">
          Studio
        </a>
        {MOBILE_NAV.map((id) => (
          <button
            key={id}
            type="button"
            className={id === "create" ? "is-create" : undefined}
            aria-current={view === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            {t.nav[id]}
          </button>
        ))}
      </nav>
    </div>
  );
}

function WorldsGallery({
  t,
  result,
  selectedId,
  onSelect,
  createHref,
  standalone = false
}: {
  t: WorldsCopy;
  result: StudioWorldsResult;
  selectedId: string;
  onSelect: (id: string) => void;
  createHref: string;
  standalone?: boolean;
}) {
  const worlds = result.kind === "fixtures" || result.kind === "live" ? result.worlds : [];

  return (
    <section className={`worlds${standalone ? " worlds--page" : ""}`} aria-labelledby="worlds-title">
      <div className="worlds__intro">
        <div>
          <h2 id="worlds-title">{t.gallery.title}</h2>
          <p>{t.gallery.lead}</p>
        </div>
        <a className="atelier-secondary" href={createHref}>
          {t.gallery.startNew}
        </a>
      </div>

      {result.kind === "loading" ? (
        <p className="worlds__message" role="status">
          {t.gallery.loading}
        </p>
      ) : null}

      {result.kind === "error" ? (
        <div className="worlds__message" role="alert">
          <p>{t.gallery.error}</p>
          <button type="button" className="atelier-secondary" onClick={() => window.location.reload()}>
            {t.gallery.retry}
          </button>
        </div>
      ) : null}

      {result.kind === "live" && worlds.length === 0 ? (
        <div className="worlds__empty">
          <p className="worlds__empty-title">{t.gallery.emptyTitle}</p>
          <p>{t.gallery.emptyBody}</p>
          <a className="atelier-cta" href={createHref}>
            {t.atelier.startWithPhoto}
          </a>
        </div>
      ) : null}

      {(result.kind === "fixtures" || (result.kind === "live" && worlds.length > 0)) && (
        <div className="worlds__gallery">
          {worlds.map((world) => {
            const crop = cropClass(world.visualVariant);
            const art = resolveArt(world, result.kind);
            const status = t.gallery.status[world.status];
            const className = `world-poster world-poster--${crop}${
              selectedId === world.id ? " is-selected" : ""
            }`;
            const label = [world.title, world.updatedLabel, status]
              .map((part) => part.replace(/\.$/, ""))
              .filter(Boolean)
              .join(". ");
            const body = (
              <>
                <WorldPosterArt world={world} art={art} />
                <span className="world-poster__shade" />
                <span className="world-poster__copy">
                  <strong>{world.title}</strong>
                  <em>{world.updatedLabel}</em>
                </span>
                <span className="world-poster__meta">{status}</span>
              </>
            );

            if (world.href) {
              return (
                <a
                  key={world.id}
                  href={world.href}
                  className={className}
                  aria-label={label}
                  onClick={() => onSelect(world.id)}
                >
                  {body}
                </a>
              );
            }

            return (
              <button
                key={world.id}
                type="button"
                className={className}
                aria-pressed={selectedId === world.id}
                aria-label={label}
                onClick={() => onSelect(world.id)}
              >
                {body}
              </button>
            );
          })}

          <blockquote className="world-quote">
            <p>{t.gallery.quote}</p>
          </blockquote>
        </div>
      )}
    </section>
  );
}

function CreateView({ t, createHref }: { t: WorldsCopy; createHref: string }) {
  return (
    <section className="create-view" aria-labelledby="create-title">
      <div className="create-view__intro">
        <p className="atelier-kicker">{t.create.kicker}</p>
        <h1 id="create-title">{t.create.title}</h1>
        <p>{t.create.lead}</p>
      </div>

      <div className="create-grid">
        {CREATE_CHOICES.map((choice) => {
          const copy = t.create.choices[choice.id];
          const body = (
            <>
              <span className="create-door__art">
                <Artwork id={`create-${choice.id}`} kind={choice.art} />
              </span>
              <span className="create-door__copy">
                <span className={`create-door__state${choice.available ? " is-open" : ""}`}>
                  {choice.available ? t.create.available : t.create.soon}
                </span>
                <strong>{copy.title}</strong>
                <em>{copy.detail}</em>
              </span>
            </>
          );

          if (choice.available) {
            return (
              <a
                key={choice.id}
                href={createHref}
                className={`create-door create-door--${choice.id}`}
                aria-label={`${copy.title}. ${t.create.continueHint}`}
              >
                {body}
              </a>
            );
          }

          return (
            <button
              key={choice.id}
              type="button"
              className={`create-door create-door--${choice.id}`}
              disabled
              aria-disabled="true"
            >
              {body}
            </button>
          );
        })}
      </div>

      <form
        className="create-whisper"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="imagine-prompt">{t.create.promptLabel}</label>
        <textarea
          id="imagine-prompt"
          name="prompt"
          readOnly
          aria-disabled="true"
          placeholder={t.create.promptPlaceholder}
        />
        <p>{t.create.promptNote}</p>
      </form>
    </section>
  );
}

function LibraryView({
  t,
  filter,
  onFilter,
  assets
}: {
  t: WorldsCopy;
  filter: "all" | FixtureAssetKind;
  onFilter: (next: "all" | FixtureAssetKind) => void;
  assets: typeof FIXTURE_ASSETS;
}) {
  return (
    <section className="cabinet" aria-labelledby="cabinet-title">
      <div className="cabinet__intro">
        <p className="atelier-kicker">{t.library.kicker}</p>
        <h1 id="cabinet-title">{t.library.title}</h1>
        <p>{t.library.lead}</p>
      </div>

      <div className="cabinet__filters" role="tablist" aria-label={t.library.filtersLabel}>
        {LIBRARY_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "is-active" : undefined}
            onClick={() => onFilter(id)}
          >
            {t.library.filters[id]}
          </button>
        ))}
      </div>

      <div className="cabinet__masonry">
        {assets.map((asset) => {
          const copy = t.library.assets[asset.key];
          return (
            <article
              key={asset.id}
              className={`cabinet-object cabinet-object--${asset.size}`}
              tabIndex={0}
              aria-label={`${copy.title}. ${copy.meta}`}
            >
              <Artwork id={`asset-${asset.id}`} kind={asset.art} />
              <div className="cabinet-object__reveal">
                <strong>{copy.title}</strong>
                <span>{copy.meta}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
