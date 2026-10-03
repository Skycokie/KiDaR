"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@/i18n/types";
import { cameraViewPlatform, type CameraViewPlatform } from "@/lib/camera-view";

type Props = {
  modelUrl: string | null;
  qrDataUrl: string | null;
  arPageHref: string;
  copy: Messages["ar"];
};

const shell = {
  minHeight: "100vh",
  padding: "1.25rem",
  background: "#0f1419",
  color: "#f4f7fb",
  fontFamily: "system-ui, sans-serif",
  display: "grid",
  gap: "1rem",
  alignContent: "start",
  justifyItems: "center"
} as const;

const pill = {
  display: "inline-block",
  minHeight: 48,
  padding: "0.8rem 1.2rem",
  borderRadius: 999,
  border: "1px solid rgba(244,247,251,0.25)",
  color: "#f4f7fb",
  textDecoration: "none",
  fontWeight: 600
} as const;

export function CameraViewClient({ modelUrl, qrDataUrl, arPageHref, copy }: Props) {
  const [platform, setPlatform] = useState<CameraViewPlatform | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    setPlatform(
      cameraViewPlatform({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints
      })
    );
    if (!modelUrl) return;
    let cancelled = false;
    void import("@google/model-viewer").then((mod) => {
      const element = mod.ModelViewerElement as unknown as { dracoDecoderLocation?: string };
      element.dracoDecoderLocation = "/draco/gltf/";
      if (!cancelled) setViewerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const desktop = platform === "desktop";

  return (
    <main style={shell}>
      <h1 style={{ margin: 0, fontSize: "1.3rem" }}>{desktop ? copy.desktopTitle : copy.cameraTitle}</h1>
      <p data-testid="camera-character-only" style={{ margin: 0, opacity: 0.8, textAlign: "center" }}>
        {copy.cameraCharacterOnly}
      </p>

      {!modelUrl ? (
        <p role="alert" style={{ margin: 0, padding: "0.75rem 1rem", borderRadius: 12, background: "#5c1d1d" }}>
          {copy.cameraMissingModel}
        </p>
      ) : viewerReady && platform ? (
        <model-viewer
          src={modelUrl}
          alt={copy.cameraTitle}
          camera-controls
          {...(desktop
            ? { "auto-rotate": true }
            : { ar: true, "ar-modes": "webxr scene-viewer quick-look" })}
          touch-action="pan-y"
          style={{ width: "100%", maxWidth: "32rem", height: "60vh", background: "#1a1f2a", borderRadius: 16 }}
        >
          {!desktop ? (
            <button
              slot="ar-button"
              type="button"
              style={{
                position: "absolute",
                left: "50%",
                bottom: 16,
                transform: "translateX(-50%)",
                minHeight: 48,
                padding: "0 1.25rem",
                borderRadius: 999,
                border: 0,
                background: "#6d5dfc",
                color: "#fff",
                fontWeight: 700
              }}
            >
              {copy.cameraOpenAr}
            </button>
          ) : null}
        </model-viewer>
      ) : (
        <p style={{ margin: 0, opacity: 0.7 }}>{copy.cameraLoading}</p>
      )}

      {desktop ? (
        <section style={{ display: "grid", gap: "0.6rem", justifyItems: "center", maxWidth: "22rem", textAlign: "center" }}>
          <p style={{ margin: 0 }}>{copy.desktopBody}</p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={copy.desktopQrAlt}
              width={192}
              height={192}
              style={{ background: "#fff", padding: 8, borderRadius: 12 }}
            />
          ) : null}
        </section>
      ) : null}

      <a href={arPageHref} style={pill}>
        {copy.cameraBackToAr}
      </a>
    </main>
  );
}
