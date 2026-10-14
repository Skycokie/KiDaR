"use client";

import { useId, useRef, useState } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import {
  friendlyFigureName,
  postImportedGlbFile,
  searchGalleryModels,
  selectGalleryModel,
  type GalleryModelHit
} from "./import-model-client";

export type ImportedModelInfo = {
  modelUrl: string;
  publicUrl: string | null;
  promoted: boolean;
  label: string;
  source: "gallery" | "file";
};

type TabId = "gallery" | "file";

export function ImportModelCard({
  projectId,
  selected,
  onSelected
}: {
  projectId?: string | null;
  selected: ImportedModelInfo | null;
  onSelected: (info: ImportedModelInfo | null) => void;
}) {
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<TabId>("gallery");
  const [query, setQuery] = useState("character");
  const [hits, setHits] = useState<GalleryModelHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const errorText = (code: string) => {
    const map = COPY.importErrors as Record<string, string>;
    return map[code] ?? COPY.importErrors.generic;
  };

  const runSearch = async () => {
    setBusy(true);
    setError(null);
    const models = await searchGalleryModels(query);
    setHits(models);
    setBusy(false);
    if (models.length === 0) setNotice(COPY.importGalleryEmpty);
    else setNotice(null);
  };

  const pickGallery = async (hit: GalleryModelHit) => {
    if (!projectId || !hit.glbUrl) return;
    setBusy(true);
    setError(null);
    const result = await selectGalleryModel(projectId, hit.glbUrl);
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    onSelected({
      modelUrl: result.modelUrl,
      publicUrl: result.publicUrl,
      promoted: result.promoted,
      label: friendlyFigureName(hit.name),
      source: "gallery"
    });
    setNotice(COPY.importSelected);
  };

  const pickFile = async (file: File | null) => {
    if (!projectId || !file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await postImportedGlbFile(projectId, file);
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    onSelected({
      modelUrl: result.modelUrl,
      publicUrl: result.publicUrl,
      promoted: result.promoted,
      label: file.name.replace(/\.glb$/i, "") || COPY.importFileLabel,
      source: "file"
    });
    setNotice(result.promoted ? COPY.importSelected : COPY.importNeedsCdn);
  };

  if (!projectId) {
    return <p className="studio-ws__muted">{COPY.importNeedsProject}</p>;
  }

  return (
    <div className="studio-ws__import" data-import-ready={selected ? "yes" : "no"}>
      <p className="studio-ws__muted">{COPY.importSupport}</p>
      <div className="studio-ws__import-tabs" role="tablist" aria-label={COPY.importTabsLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "gallery"}
          className={tab === "gallery" ? "is-active" : undefined}
          onClick={() => setTab("gallery")}
        >
          {COPY.importTabGallery}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "file"}
          className={tab === "file" ? "is-active" : undefined}
          onClick={() => setTab("file")}
        >
          {COPY.importTabFile}
        </button>
      </div>

      {tab === "gallery" ? (
        <div className="studio-ws__import-gallery" role="tabpanel">
          <label className="studio-ws__import-search">
            <span className="studio-ws__sr-only">{COPY.importSearchLabel}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={COPY.importSearchPlaceholder}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button type="button" className="studio-ws__ghost-btn" disabled={busy} onClick={() => void runSearch()}>
              {busy ? COPY.importSearching : COPY.importSearch}
            </button>
          </label>
          <ul className="studio-ws__import-grid">
            {hits.map((hit) => {
              const active = selected?.modelUrl === hit.glbUrl;
              return (
                <li key={hit.id ?? hit.glbUrl ?? hit.name}>
                  <button
                    type="button"
                    className={`studio-ws__import-tile${active ? " is-selected" : ""}`}
                    disabled={busy || !hit.glbUrl}
                    onClick={() => void pickGallery(hit)}
                  >
                    {hit.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.thumbnailUrl} alt="" />
                    ) : (
                      <span className="studio-ws__import-tile-fallback" aria-hidden="true" />
                    )}
                    <span>{friendlyFigureName(hit.name)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="studio-ws__import-file" role="tabpanel">
          <p className="studio-ws__muted">{COPY.importFileHint}</p>
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept=".glb,model/gltf-binary"
            className="studio-ws__sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void pickFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="studio-ws__primary-btn"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? COPY.importFileBusy : COPY.importFilePick}
          </button>
        </div>
      )}

      {selected ? (
        <p className="studio-ws__import-current" role="status">
          {COPY.importCurrent.replace("{name}", selected.label)}
        </p>
      ) : null}
      {notice ? (
        <p className="studio-ws__muted" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="studio-ws__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
