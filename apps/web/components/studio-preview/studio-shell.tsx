"use client";

import { useMemo, useState } from "react";
import {
  artKindFromId,
  fixtureStudioWorlds,
  type StudioWorldCard,
  type StudioWorldsResult
} from "@/lib/studio-worlds";
import { SiteHeader } from "@/components/site-nav";
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

function cropClass(variant: StudioWorldCard["visualVariant"]): string {
  if (variant === "landscape") return "panorama";
  return variant;
}

function resolveArt(world: StudioWorldCard, sourceKind: StudioWorldsResult["kind"]) {
  if (sourceKind === "fixtures") {
    const fixture = FIXTURE_PROJECTS.find((item) => item.id === world.id);
    if (fixture) return fixture.art;
  }
  return artKindFromId(world.id);
}

export function StudioShell({
  worldsResult = { kind: "fixtures", worlds: fixtureStudioWorlds() },
  createHref = "/intra"
}: {
  worldsResult?: StudioWorldsResult;
  /** Existing Simple Creator entry — /creaza when signed in, /intra when guest. */
  createHref?: string;
}) {
  const worlds = worldsResult.kind === "fixtures" || worldsResult.kind === "live" ? worldsResult.worlds : [];
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
        Sari la conținut
      </a>

      <SiteHeader
        brandHref="/studio"
        trailing={
          <>
            <button
              type="button"
              className="studio-header__ghost studio-header__secondary"
              aria-current={view === "worlds" ? "page" : undefined}
              onClick={() => go("worlds")}
            >
              Lumi
            </button>
            <button
              type="button"
              className="studio-header__ghost studio-header__secondary"
              aria-current={view === "library" ? "page" : undefined}
              onClick={() => go("library")}
            >
              Bibliotecă
            </button>
            <button type="button" className="studio-header__ghost" disabled>
              Profil
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
              Lumi
            </button>
            <button
              type="button"
              className="site-header__sheet-btn"
              aria-current={view === "library" ? "page" : undefined}
              onClick={() => go("library")}
            >
              Bibliotecă
            </button>
            <button
              type="button"
              className="site-header__sheet-btn"
              aria-current={view === "create" ? "page" : undefined}
              onClick={() => go("create")}
            >
              Creează
            </button>
            <button type="button" className="site-header__sheet-btn" disabled>
              Profil
            </button>
          </>
        }
      />

      <main id="studio-main" className="studio-main">
        {view === "atelier" ? (
          <>
            <section className="atelier-hero" aria-labelledby="atelier-title">
              <div className="atelier-hero__copy">
                <p className="atelier-kicker">Atelier</p>
                <h1 id="atelier-title" className="atelier-title">
                  Orice poză poate
                  <br />
                  deveni o lume.
                </h1>
                <p className="atelier-lead">
                  Adaugă o poză, alege ce prinde viață și vezi-l în AR.
                </p>
                <div className="atelier-actions">
                  <a className="atelier-cta" href={createHref}>
                    Începe cu o poză
                  </a>
                  <button type="button" className="atelier-secondary" onClick={() => go("worlds")}>
                    Vezi lumile tale →
                  </button>
                </div>
                <ol className="atelier-steps" aria-label="Cum începe">
                  <li>
                    <span>01</span> Poza ta
                  </li>
                  <li>
                    <span>02</span> Lumea ta
                  </li>
                  <li>
                    <span>03</span> Pe telefonul tău
                  </li>
                </ol>
              </div>
              <HeroStage />
            </section>

            <WorldsGallery
              result={worldsResult}
              selectedId={selectedWorld}
              onSelect={setSelectedWorld}
              createHref={createHref}
            />
          </>
        ) : null}

        {view === "worlds" ? (
          <WorldsGallery
            result={worldsResult}
            selectedId={selectedWorld}
            onSelect={setSelectedWorld}
            createHref={createHref}
            standalone
          />
        ) : null}

        {view === "create" ? <CreateView createHref={createHref} /> : null}

        {view === "library" ? (
          <LibraryView filter={libraryFilter} onFilter={setLibraryFilter} assets={assets} />
        ) : null}

        {view === "settings" ? (
          <section className="studio-quiet">
            <h1>Setări</h1>
            <p>Utilitarele vin mai târziu. Aici rămâne un spațiu calm și dens, nu o scenă cinematică.</p>
          </section>
        ) : null}
      </main>

      <nav className="studio-mobile-nav" aria-label="Mobil">
        <a href="/creaza">Atelier</a>
        <a href="/studio" aria-current="page">
          Studio
        </a>
        {MOBILE_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === "create" ? "is-create" : undefined}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function WorldsGallery({
  result,
  selectedId,
  onSelect,
  createHref,
  standalone = false
}: {
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
          <h2 id="worlds-title">Lumile tale</h2>
          <p>Nu o listă de fișiere — afișe, coperți, postere din pozele tale.</p>
        </div>
        <a className="atelier-secondary" href={createHref}>
          Începe o lume nouă →
        </a>
      </div>

      {result.kind === "loading" ? (
        <p className="worlds__message" role="status">
          Îți adunăm lumile…
        </p>
      ) : null}

      {result.kind === "error" ? (
        <div className="worlds__message" role="alert">
          <p>Nu am putut deschide lumile tale acum. Reîncearcă.</p>
          <button type="button" className="atelier-secondary" onClick={() => window.location.reload()}>
            Reîncearcă →
          </button>
        </div>
      ) : null}

      {result.kind === "live" && worlds.length === 0 ? (
        <div className="worlds__empty">
          <p className="worlds__empty-title">Nicio lume încă.</p>
          <p>Începe cu o poză — aici va apărea ca un afiș, nu ca un fișier.</p>
          <a className="atelier-cta" href={createHref}>
            Începe cu o poză
          </a>
        </div>
      ) : null}

      {(result.kind === "fixtures" || (result.kind === "live" && worlds.length > 0)) && (
        <div className="worlds__gallery">
          {worlds.map((world) => {
            const crop = cropClass(world.visualVariant);
            const art = resolveArt(world, result.kind);
            const className = `world-poster world-poster--${crop}${
              selectedId === world.id ? " is-selected" : ""
            }`;
            const label = `${world.title}. ${world.updatedLabel}. ${world.status}`;
            const body = (
              <>
                {world.preview?.kind === "safe-preview" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="studio-art" src={world.preview.src} alt={world.preview.alt} />
                ) : (
                  <Artwork id={`world-${world.id}`} kind={art} />
                )}
                <span className="world-poster__shade" />
                <span className="world-poster__copy">
                  <strong>{world.title}</strong>
                  <em>{world.updatedLabel}</em>
                </span>
                <span className="world-poster__meta">{world.status}</span>
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
            <p>„Poza devine poartă.”</p>
          </blockquote>
        </div>
      )}
    </section>
  );
}

function CreateView({ createHref }: { createHref: string }) {
  return (
    <section className="create-view" aria-labelledby="create-title">
      <div className="create-view__intro">
        <p className="atelier-kicker">Creează</p>
        <h1 id="create-title">Cu ce începe lumea?</h1>
        <p>Patru porți mari. Doar una e deschisă acum.</p>
      </div>

      <div className="create-grid">
        {CREATE_CHOICES.map((choice) => {
          const body = (
            <>
              <span className="create-door__art">
                <Artwork id={`create-${choice.id}`} kind={choice.art} />
              </span>
              <span className="create-door__copy">
                <span className={`create-door__state${choice.available ? " is-open" : ""}`}>
                  {choice.state}
                </span>
                <strong>{choice.title}</strong>
                <em>{choice.detail}</em>
              </span>
            </>
          );

          if (choice.available) {
            return (
              <a
                key={choice.id}
                href={createHref}
                className={`create-door create-door--${choice.id}`}
                aria-label={`${choice.title}. Continuă în fluxul existent de creare.`}
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
        <label htmlFor="imagine-prompt">Imaginează ce apare din poză…</label>
        <textarea
          id="imagine-prompt"
          name="prompt"
          readOnly
          aria-disabled="true"
          placeholder="Un vulpoi de hârtie cu urechi din acuarelă…"
        />
        <p>În curând. Fără generare acum, fără chat, fără pretenții false.</p>
      </form>
    </section>
  );
}

function LibraryView({
  filter,
  onFilter,
  assets
}: {
  filter: "all" | FixtureAssetKind;
  onFilter: (next: "all" | FixtureAssetKind) => void;
  assets: typeof FIXTURE_ASSETS;
}) {
  return (
    <section className="cabinet" aria-labelledby="cabinet-title">
      <div className="cabinet__intro">
        <p className="atelier-kicker">Bibliotecă</p>
        <h1 id="cabinet-title">Biblioteca ta</h1>
        <p>Desene, personaje, sunete și lumi care așteaptă să prindă viață.</p>
      </div>

      <div className="cabinet__filters" role="tablist" aria-label="Filtre bibliotecă">
        {LIBRARY_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={filter === item.id ? "is-active" : undefined}
            onClick={() => onFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="cabinet__masonry">
        {assets.map((asset) => (
          <article
            key={asset.id}
            className={`cabinet-object cabinet-object--${asset.size}`}
            tabIndex={0}
            aria-label={`${asset.title}. ${asset.meta}`}
          >
            <Artwork id={`asset-${asset.id}`} kind={asset.art} />
            <div className="cabinet-object__reveal">
              <strong>{asset.title}</strong>
              <span>{asset.meta}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
