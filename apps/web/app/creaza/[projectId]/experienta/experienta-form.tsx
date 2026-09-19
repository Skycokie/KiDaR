"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  EXPERIENCE_COPY,
  GALLERY_CHIPS,
  experiencePatch,
  friendlyFigureName,
  gallerySearchPath,
  isPublishPath,
  projectPatchPath,
  showsMissionMessage,
  type ExperienceChoice
} from "@/lib/simple-creator";

const SAVE_ERROR = "Nu am putut salva alegerea. Încearcă din nou.";
const GALLERY_EMPTY = "Nu am găsit figurile acum. Poți alege Iese din pagină.";

type GalleryFigure = { id: string; name: string; thumbnailUrl: string | null; glbUrl: string | null };

export function CreazaExperientaForm({
  projectId,
  preset,
  initialMode,
  initialCtaText,
  initialGalleryUrl
}: {
  projectId: string;
  preset?: string;
  initialMode?: string;
  initialCtaText?: string;
  initialGalleryUrl?: string;
}) {
  const router = useRouter();
  const errorId = useId();
  const hintId = useId();
  const [choice, setChoice] = useState<ExperienceChoice>(
    initialMode === "gallery" ? "gallery" : "popout"
  );
  const [ctaText, setCtaText] = useState(initialCtaText ?? "");
  const [galleryQuery, setGalleryQuery] = useState<string>(GALLERY_CHIPS[0].query);
  const [figures, setFigures] = useState<GalleryFigure[]>([]);
  const [selectedUrl, setSelectedUrl] = useState(initialGalleryUrl ?? "");
  const [galleryStatus, setGalleryStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mission = showsMissionMessage(preset);

  useEffect(() => {
    if (error) document.getElementById(errorId)?.focus();
  }, [error, errorId]);

  useEffect(() => {
    if (choice !== "gallery") return;
    const controller = new AbortController();
    setGalleryStatus("loading");
    const url = gallerySearchPath(galleryQuery);
    if (isPublishPath(url)) {
      setGalleryStatus("error");
      setFigures([]);
      return;
    }
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("gallery");
        const body = (await response.json()) as { models?: GalleryFigure[] };
        const models = (body.models ?? []).filter((item) => item.glbUrl);
        setFigures(models);
        setGalleryStatus(models.length ? "idle" : "empty");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setFigures([]);
        setGalleryStatus("error");
      });
    return () => controller.abort();
  }, [choice, galleryQuery]);

  async function continueSave() {
    const patch = experiencePatch({
      choice,
      preset,
      ctaText,
      galleryModelUrl: choice === "gallery" ? selectedUrl || null : null
    });
    const url = projectPatchPath(projectId);
    if (isPublishPath(url)) {
      setError(SAVE_ERROR);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!response.ok) {
        setError(SAVE_ERROR);
        return;
      }
      router.push(`/creaza/${projectId}`);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="creaza-lead">Copilul va îndrepta telefonul spre aceeași pagină.</p>

      <ul className="creaza-card-list">
        {(Object.keys(EXPERIENCE_COPY) as ExperienceChoice[]).map((value) => {
          const copy = EXPERIENCE_COPY[value];
          return (
            <li key={value}>
              <button
                type="button"
                id={`experienta-${value}`}
                className="creaza-choice"
                aria-pressed={choice === value}
                onClick={() => {
                  setChoice(value);
                  setError("");
                }}
              >
                <span className="creaza-choice-title">{copy.title}</span>
                <span className="creaza-choice-copy">{copy.lead}</span>
                <span className="creaza-choice-copy">{copy.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {choice === "gallery" ? (
        <div>
          <p className="creaza-lead">Alege o figurină din listă.</p>
          <div className="creaza-chips">
            {GALLERY_CHIPS.map((chip) => (
              <button
                key={chip.query}
                type="button"
                className="creaza-chip"
                aria-pressed={galleryQuery === chip.query}
                onClick={() => setGalleryQuery(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <p className="creaza-status" role="status" aria-live="polite">
            {galleryStatus === "loading" ? "Căutăm figurile…" : ""}
          </p>
          {galleryStatus === "empty" || galleryStatus === "error" ? (
            <p className="creaza-error">{GALLERY_EMPTY}</p>
          ) : null}
          {figures.length ? (
            <div className="creaza-figure-grid">
              {figures.map((figure) => {
                const label = friendlyFigureName(figure.name);
                return (
                  <button
                    key={figure.id ?? figure.glbUrl}
                    type="button"
                    className="creaza-figure"
                    aria-pressed={selectedUrl === figure.glbUrl}
                    onClick={() => setSelectedUrl(figure.glbUrl ?? "")}
                  >
                    {figure.thumbnailUrl ? <img src={figure.thumbnailUrl} alt="" /> : null}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {mission ? (
        <div className="creaza-field">
          <label htmlFor="creaza-mission-message">Mesaj pentru participanți (opțional)</label>
          <p className="creaza-note" id={hintId}>
            De exemplu: „Caută cheia roșie lângă hartă.”
          </p>
          <textarea
            id="creaza-mission-message"
            maxLength={80}
            value={ctaText}
            aria-describedby={hintId}
            onChange={(event) => setCtaText(event.target.value)}
          />
        </div>
      ) : null}

      {error ? (
        <p className="creaza-error" id={errorId} role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}
      <p className="creaza-status" role="status" aria-live="polite">
        {loading ? "Salvăm alegerea…" : ""}
      </p>

      <div className="creaza-actions" aria-busy={loading}>
        <button
          className="creaza-btn creaza-btn-primary"
          type="button"
          disabled={loading}
          onClick={() => void continueSave()}
        >
          Continuă
        </button>
        <Link className="creaza-btn creaza-btn-secondary" href={`/creaza/${projectId}/foto`}>
          Înapoi
        </Link>
        <Link className="creaza-btn creaza-btn-secondary" href={`/studio/${projectId}`}>
          Opțiuni avansate în Studio
        </Link>
      </div>
    </>
  );
}
