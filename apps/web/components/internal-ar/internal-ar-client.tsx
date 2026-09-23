"use client";

import { useCallback, useEffect, useState } from "react";
import { figureStagingUiMessage, type FigureAssetStatus } from "@kidar/core";

type Props = {
  projectId: string;
  projectName: string;
};

type FiguresApiResponse = {
  projectId: string;
  status: FigureAssetStatus;
  glbUrl?: string;
  usdzUrl?: string;
  expiresAt?: string;
  errorCode?: string;
  message?: string;
  error?: string;
};

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InternalArClient({ projectId, projectName }: Props) {
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const [apple, setApple] = useState(false);
  const [payload, setPayload] = useState<FiguresApiResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch(`/api/internal/figures/${encodeURIComponent(projectId)}`, {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (response.status === 404) {
        setLoadError(true);
        setPayload(null);
        return;
      }
      if (!response.ok) {
        setLoadError(true);
        return;
      }
      const body = (await response.json()) as FiguresApiResponse;
      setPayload(body);
    } catch {
      setLoadError(true);
    }
  }, [projectId]);

  useEffect(() => {
    setApple(isAppleDevice());
    let cancelled = false;
    void import("@google/model-viewer").then(() => {
      if (!cancelled) setModelViewerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!payload?.expiresAt || payload.status !== "ready") return;
    const expiresMs = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresMs)) return;
    const delay = Math.max(5_000, expiresMs - Date.now() - 30_000);
    const timer = window.setTimeout(() => {
      void loadAssets();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [payload?.expiresAt, payload?.status, loadAssets]);

  const status = payload?.status ?? "pending";
  const message =
    payload?.message ||
    figureStagingUiMessage(status, payload?.errorCode) ||
    (loadError ? "Nu am putut încărca figurina" : "Figurina 3D se pregătește");
  const glbUrl = payload?.status === "ready" ? payload.glbUrl : undefined;
  const usdzUrl = payload?.status === "ready" ? payload.usdzUrl : undefined;
  const arEnabled = status === "ready" && Boolean(usdzUrl);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "1.25rem",
        background: "#0f1218",
        color: "#f3efe6",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      <p style={{ opacity: 0.7, margin: "0 0 0.35rem", fontSize: "0.8rem" }}>
        Staging intern · {projectId}
      </p>
      <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.35rem" }}>{projectName}</h1>
      <p style={{ margin: "0 0 1rem", color: "rgba(243,239,230,0.78)" }}>{message}</p>

      {status === "ready" && glbUrl ? (
        <section style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>Previzualizare 3D</h2>
          <p style={{ fontSize: "0.85rem", color: "rgba(243,239,230,0.65)", margin: "0 0 0.75rem" }}>
            Scena din browser — nu este AR. Pe desktop poți roti și mări modelul; AR nativ depinde de
            dispozitiv.
          </p>
          {modelViewerReady ? (
            <model-viewer
              src={glbUrl}
              ios-src={usdzUrl || undefined}
              alt="Figurina 3D"
              camera-controls
              ar={Boolean(usdzUrl)}
              ar-modes={usdzUrl ? "quick-look" : undefined}
              touch-action="pan-y"
              style={{
                width: "100%",
                maxWidth: "28rem",
                height: "22rem",
                background: "#1a1f2a",
                borderRadius: "1rem"
              }}
            />
          ) : (
            <p style={{ opacity: 0.6 }}>Se încarcă viewer-ul 3D…</p>
          )}
        </section>
      ) : null}

      <div style={{ display: "grid", gap: "0.6rem", maxWidth: "20rem" }}>
        {arEnabled && usdzUrl && apple ? (
          <a rel="ar" href={usdzUrl} style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ar-placeholder.svg"
              alt="Deschide figurina în AR"
              width={320}
              height={48}
              style={{
                display: "block",
                width: "100%",
                height: 48,
                borderRadius: 999,
                background: "#e8a05a"
              }}
            />
          </a>
        ) : (
          <button
            type="button"
            disabled
            title={status === "failed" ? message : "Figurina 3D se pregătește"}
            style={{
              minHeight: 48,
              borderRadius: 999,
              border: "1px solid rgba(243,239,230,0.2)",
              background: "rgba(243,239,230,0.08)",
              color: "rgba(243,239,230,0.55)",
              cursor: "not-allowed"
            }}
          >
            {status === "failed"
              ? "AR indisponibil"
              : arEnabled && !apple
                ? "AR pe iPhone"
                : "Figurina 3D se pregătește"}
          </button>
        )}
        {arEnabled && usdzUrl && !apple ? (
          <p style={{ fontSize: "0.8rem", color: "rgba(243,239,230,0.65)", margin: 0 }}>
            Quick Look (AR) este disponibil pe iPhone/iPad Safari. Pe acest dispozitiv folosește
            previzualizarea 3D de mai sus.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void loadAssets()}
          style={{
            minHeight: 40,
            borderRadius: 999,
            border: "1px solid rgba(243,239,230,0.18)",
            background: "transparent",
            color: "rgba(243,239,230,0.75)",
            cursor: "pointer"
          }}
        >
          Reîncarcă asset-urile
        </button>
      </div>
    </main>
  );
}
