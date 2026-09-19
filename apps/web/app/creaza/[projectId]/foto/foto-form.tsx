"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  SOURCE_ACCEPT,
  isPublishPath,
  sourceUploadPath,
  validateSourceImage
} from "@/lib/simple-creator";

const INVALID_COPY = "Putem folosi doar fotografii JPG sau PNG, până la 10 MB.";
const SAVE_ERROR = "Nu am putut salva fotografia. Încearcă din nou.";
const SMALL_COPY =
  "Fotografia pare foarte mică. Pentru un rezultat mai bun, alege o fotografie mai clară.";

export function CreazaFotoForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const errorId = useId();
  const warnId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [small, setSmall] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function applyFile(next: File | undefined) {
    if (!next) return;
    const result = validateSourceImage(next);
    if (!result.ok) {
      setFile(null);
      setPreview("");
      setSmall(false);
      setError(INVALID_COPY);
      return;
    }
    setError("");
    setFile(next);
    setSmall(result.small);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  async function upload() {
    if (!file) {
      setError(INVALID_COPY);
      return;
    }
    const check = validateSourceImage(file);
    if (!check.ok) {
      setError(INVALID_COPY);
      return;
    }
    const url = sourceUploadPath(projectId);
    if (isPublishPath(url)) {
      setError(SAVE_ERROR);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(url, { method: "POST", body });
      if (!response.ok) {
        setError(response.status === 415 || response.status === 413 ? INVALID_COPY : SAVE_ERROR);
        return;
      }
      router.push(`/creaza/${projectId}/experienta`);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setLoading(false);
    }
  }

  const describedBy = [error ? errorId : "", small ? warnId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <p className="creaza-lead">
        Pune pagina pe masă, cu lumină bună. Fotografiază de deasupra și păstrează desenul întreg în
        cadru.
      </p>
      <ul className="creaza-checklist">
        <li>✓ Se vede pagina întreagă</li>
        <li>✓ Nu sunt umbre puternice</li>
        <li>✓ Vei folosi aceeași pagină tipărită când deschizi surpriza pe telefon</li>
      </ul>
      <p className="creaza-note">Nu fotografia un ecran.</p>

      {preview ? (
        <img className="creaza-preview" src={preview} alt="Pagina fotografiată" />
      ) : null}
      {small ? (
        <p className="creaza-warn" id={warnId}>
          {SMALL_COPY}
        </p>
      ) : null}

      <input
        ref={cameraRef}
        id="creaza-camera"
        className="creaza-sr-only"
        type="file"
        accept={SOURCE_ACCEPT}
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          applyFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        id="creaza-library"
        className="creaza-sr-only"
        type="file"
        accept={SOURCE_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          applyFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error ? (
        <p className="creaza-error" id={errorId} role="alert" ref={errorRef} tabIndex={-1}>
          {error}
        </p>
      ) : null}
      <p className="creaza-status" role="status" aria-live="polite">
        {loading ? "Salvăm fotografia…" : ""}
      </p>

      <div className="creaza-actions" aria-busy={loading}>
        <button
          className="creaza-btn creaza-btn-primary"
          type="button"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => cameraRef.current?.click()}
        >
          Fotografiază
        </button>
        <button
          className="creaza-btn creaza-btn-secondary"
          type="button"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => libraryRef.current?.click()}
        >
          Alege din pozele telefonului
        </button>
        <button
          className="creaza-btn creaza-btn-primary"
          type="button"
          disabled={loading || !file}
          onClick={() => void upload()}
        >
          {loading ? "Salvăm fotografia…" : "Continuă"}
        </button>
        <Link className="creaza-btn creaza-btn-secondary" href="/creaza">
          Înapoi
        </Link>
      </div>
    </>
  );
}
