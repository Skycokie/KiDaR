"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useState } from "react";
import {
  CREATOR_PRESET_COPY,
  CREATOR_PRESETS,
  friendlySurpriseName,
  technicalModeForPreset,
  type SimpleCreatorPreset
} from "@/lib/simple-creator";

export function CreazaPresetForm() {
  const router = useRouter();
  const errorId = useId();
  const [preset, setPreset] = useState<SimpleCreatorPreset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"select" | "quota" | "generic" | "">("");

  async function continueCreate(event: FormEvent) {
    event.preventDefault();
    if (!preset) {
      setError("select");
      document.getElementById("preset-coloring")?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: friendlySurpriseName(),
          mode: technicalModeForPreset(preset),
          settings: { preset }
        })
      });
      const body = (await response.json()) as {
        project?: { id: string; settings?: { preset?: string } };
        upgrade?: boolean;
      };
      if (response.status === 403 || body.upgrade) {
        setError("quota");
        return;
      }
      if (!response.ok || !body.project?.id) {
        setError("generic");
        return;
      }
      router.push(`/creaza/${body.project.id}`);
    } catch {
      setError("generic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={continueCreate} aria-busy={loading}>
      <ul className="creaza-card-list">
        {CREATOR_PRESETS.map((value) => {
          const copy = CREATOR_PRESET_COPY[value];
          const selected = preset === value;
          return (
            <li key={value}>
              <button
                type="button"
                id={`preset-${value}`}
                className="creaza-choice"
                aria-pressed={selected}
                onClick={() => {
                  setPreset(value);
                  setError("");
                }}
              >
                <span className="creaza-choice-title">{copy.title}</span>
                <span className="creaza-choice-copy">{copy.description}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {error === "select" ? (
        <p className="creaza-error" id={errorId} role="alert">
          Alege ce vrei să prindă viață.
        </p>
      ) : null}
      {error === "quota" ? (
        <div className="creaza-error" id={errorId} role="alert">
          <p>Ai folosit surprizele din planul gratuit.</p>
          <p>Poți folosi în continuare Studio pentru proiectele existente.</p>
        </div>
      ) : null}
      {error === "generic" ? (
        <p className="creaza-error" id={errorId} role="alert">
          Nu am putut salva alegerea. Încearcă din nou.
        </p>
      ) : null}

      <div className="creaza-actions">
        <button className="creaza-btn creaza-btn-primary" type="submit" disabled={loading}>
          {loading ? "Pregătim surpriza…" : "Continuă"}
        </button>
        <Link className="creaza-btn creaza-btn-secondary" href="/dashboard">
          Deschide Studio (English)
        </Link>
      </div>
    </form>
  );
}
