"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  arScanHonestyCopy,
  arScanIdleCopy,
  arScanPrimaryLabel,
  canContinueWithoutScan,
  canProjectFigurine,
  canStartCamera,
  reduceArScanState,
  type ArScanState
} from "./ar-scan-state";
import {
  createMatcherStability,
  MATCHER_STABLE_FRAMES,
  MATCHER_TARGET_SIZE,
  pushMatcherScore,
  rgbaToGrayFrame,
  scoreDrawingMatch,
  type GrayFrame,
  type MatcherStability
} from "./local-drawing-matcher";

type Props = {
  projectId: string;
  projectName: string;
  hasSource: boolean;
};

type FiguresApiResponse = {
  status?: string;
  usdzUrl?: string;
  glbUrl?: string;
  expiresAt?: string;
  message?: string;
  error?: string;
};

const SCAN_TIMEOUT_MS = 45_000;
const SAMPLE_INTERVAL_MS = 160;

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 1;
  canvas.height = 1;
}

export function ArScanClient({ projectId, projectName, hasSource }: Props) {
  const [state, setState] = useState<ArScanState>("idle");
  const [reason, setReason] = useState<string | undefined>();
  const [apple, setApple] = useState(false);
  const [usdzUrl, setUsdzUrl] = useState<string | undefined>();
  const [figuresMessage, setFiguresMessage] = useState<string | undefined>();
  const [figuresError, setFiguresError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const referenceRef = useRef<GrayFrame | null>(null);
  const stabilityRef = useRef<MatcherStability>(createMatcherStability());
  const rafRef = useRef<number | null>(null);
  const lastSampleRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const aliveRef = useRef(true);

  const dispatch = useCallback((event: Parameters<typeof reduceArScanState>[1]) => {
    setState((prev) => {
      const next = reduceArScanState(prev, event);
      if (next.reason) setReason(next.reason);
      return next.state;
    });
  }, []);

  const cleanupCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    clearCanvas(canvasRef.current);
    stabilityRef.current = createMatcherStability();
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    setApple(isAppleDevice());
    if (!hasSource) {
      dispatch({
        type: "CAMERA_UNAVAILABLE",
        reason: "Proiectul nu are desen sursă în staging."
      });
    }
    return () => {
      aliveRef.current = false;
      cleanupCamera();
      referenceRef.current = null;
    };
  }, [cleanupCamera, dispatch, hasSource]);

  const loadReference = useCallback(async (): Promise<GrayFrame | null> => {
    try {
      const response = await fetch(
        `/api/internal/figures/${encodeURIComponent(projectId)}/source`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return null;
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        bitmap.close();
        return null;
      }
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      bitmap.close();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1;
      canvas.height = 1;
      return rgbaToGrayFrame(
        imageData.data,
        imageData.width,
        imageData.height,
        MATCHER_TARGET_SIZE
      );
    } catch {
      return null;
    }
  }, [projectId]);

  const sampleLoop = useCallback(() => {
    const tick = (now: number) => {
      if (!aliveRef.current) return;
      rafRef.current = requestAnimationFrame(tick);
      if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return;
      lastSampleRef.current = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const reference = referenceRef.current;
      if (!video || !canvas || !reference || video.readyState < 2) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      // Center square crop of the camera frame.
      const side = Math.min(vw, vh);
      const sx = Math.floor((vw - side) / 2);
      const sy = Math.floor((vh - side) / 2);
      canvas.width = MATCHER_TARGET_SIZE;
      canvas.height = MATCHER_TARGET_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, side, side, 0, 0, MATCHER_TARGET_SIZE, MATCHER_TARGET_SIZE);
      const imageData = ctx.getImageData(0, 0, MATCHER_TARGET_SIZE, MATCHER_TARGET_SIZE);
      const sample = rgbaToGrayFrame(
        imageData.data,
        MATCHER_TARGET_SIZE,
        MATCHER_TARGET_SIZE,
        MATCHER_TARGET_SIZE
      );
      const score = scoreDrawingMatch(reference, sample);
      const next = pushMatcherScore(stabilityRef.current, score);
      stabilityRef.current = next;
      if (next.matched) {
        cleanupCamera();
        dispatch({ type: "MATCH_STABLE" });
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [cleanupCamera, dispatch]);

  const startCamera = useCallback(async () => {
    if (!canStartCamera(state)) return;
    dispatch({ type: "START_CAMERA" });
    cleanupCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      dispatch({
        type: "CAMERA_UNAVAILABLE",
        reason: "Acest browser nu oferă acces la cameră."
      });
      return;
    }

    const reference = referenceRef.current ?? (await loadReference());
    if (!reference) {
      dispatch({
        type: "CAMERA_UNAVAILABLE",
        reason: "Scanarea nu este disponibilă în acest build de staging"
      });
      return;
    }
    referenceRef.current = reference;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (!aliveRef.current) {
        stopMediaStream(stream);
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      stabilityRef.current = createMatcherStability();
      sampleLoop();
      timeoutRef.current = window.setTimeout(() => {
        if (!aliveRef.current) return;
        cleanupCamera();
        dispatch({ type: "SCAN_TIMEOUT" });
      }, SCAN_TIMEOUT_MS);
    } catch {
      cleanupCamera();
      dispatch({
        type: "CAMERA_UNAVAILABLE",
        reason: "Permisiunea pentru cameră a fost refuzată sau indisponibilă."
      });
    }
  }, [cleanupCamera, dispatch, loadReference, sampleLoop, state]);

  const loadUsdz = useCallback(async () => {
    setFiguresError(false);
    setFiguresMessage(undefined);
    try {
      const response = await fetch(`/api/internal/figures/${encodeURIComponent(projectId)}`, {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) {
        setFiguresError(true);
        setUsdzUrl(undefined);
        return;
      }
      const body = (await response.json()) as FiguresApiResponse;
      if (body.status === "ready" && body.usdzUrl) {
        setUsdzUrl(body.usdzUrl);
        setFiguresMessage(undefined);
      } else {
        setUsdzUrl(undefined);
        setFiguresMessage(body.message || "Figurina nu este încă gata.");
      }
    } catch {
      setFiguresError(true);
      setUsdzUrl(undefined);
    }
  }, [projectId]);

  useEffect(() => {
    if (state === "recognized" || state === "projecting" || state === "timeout") {
      void loadUsdz();
    }
  }, [state, loadUsdz]);

  const onContinueWithoutScan = useCallback(() => {
    cleanupCamera();
    dispatch({ type: "CONTINUE_WITHOUT_SCAN" });
    void loadUsdz();
  }, [cleanupCamera, dispatch, loadUsdz]);

  const onProject = useCallback(() => {
    cleanupCamera();
    dispatch({ type: "PROJECT" });
    void loadUsdz();
  }, [cleanupCamera, dispatch, loadUsdz]);

  const showProjectActions =
    canProjectFigurine(state) || state === "projecting" || state === "timeout" || state === "unavailable";

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
        Staging intern · scan · {projectId}
      </p>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem" }}>{projectName}</h1>
      <p style={{ margin: "0 0 0.75rem", color: "rgba(243,239,230,0.78)" }}>
        {state === "idle" ? arScanIdleCopy() : arScanPrimaryLabel(state)}
      </p>
      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "rgba(243,239,230,0.65)" }}>
        {arScanHonestyCopy()}
      </p>
      {reason ? (
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#e8a05a" }}>{reason}</p>
      ) : null}

      <div style={{ position: "relative", marginBottom: "1rem", maxWidth: "28rem" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{
            display: state === "camera" ? "block" : "none",
            width: "100%",
            borderRadius: "1rem",
            background: "#1a1f2a"
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden />
      </div>

      <div style={{ display: "grid", gap: "0.6rem", maxWidth: "22rem" }}>
        {canStartCamera(state) ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            style={{
              minHeight: 48,
              borderRadius: 999,
              border: 0,
              background: "#e8a05a",
              color: "#1b1726",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Pornește camera
          </button>
        ) : null}

        {state === "recognized" ? (
          <button
            type="button"
            onClick={onProject}
            style={{
              minHeight: 48,
              borderRadius: 999,
              border: 0,
              background: "#7dcea0",
              color: "#1b1726",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Proiectează figurina în AR
          </button>
        ) : null}

        {canContinueWithoutScan(state) && state !== "idle" ? (
          <button
            type="button"
            onClick={onContinueWithoutScan}
            style={{
              minHeight: 44,
              borderRadius: 999,
              border: "1px solid rgba(243,239,230,0.25)",
              background: "transparent",
              color: "rgba(243,239,230,0.85)",
              cursor: "pointer"
            }}
          >
            Continuă fără scanare
          </button>
        ) : null}

        {state === "timeout" ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(243,239,230,0.7)" }}>
            Asigură-te că desenul e bine luminat, complet în cadru, și încearcă din nou — sau
            continuă fără scanare.
          </p>
        ) : null}

        {showProjectActions && usdzUrl && apple ? (
          <a
            rel="ar"
            href={usdzUrl}
            style={{ textDecoration: "none" }}
            onClick={() => cleanupCamera()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ar-placeholder.svg"
              alt="Deschide figurina în AR (Quick Look)"
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
        ) : null}

        {showProjectActions && usdzUrl && !apple ? (
          <p style={{ fontSize: "0.8rem", color: "rgba(243,239,230,0.65)", margin: 0 }}>
            Quick Look (USDZ) este disponibil pe iPhone/iPad Safari. Poți deschide și viewerul
            intern fără scanare.
          </p>
        ) : null}

        {showProjectActions && !usdzUrl ? (
          <p style={{ fontSize: "0.85rem", color: "rgba(243,239,230,0.7)", margin: 0 }}>
            {figuresError
              ? "Nu am putut încărca URL-ul Quick Look."
              : figuresMessage || "Se încarcă figurina…"}
          </p>
        ) : null}

        <Link
          href={`/internal/ar/${encodeURIComponent(projectId)}`}
          style={{
            color: "rgba(243,239,230,0.75)",
            fontSize: "0.9rem",
            marginTop: "0.35rem"
          }}
        >
          Deschide viewerul AR fără scanare
        </Link>
      </div>

      <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", opacity: 0.45 }}>
        Cadrele rămân pe dispozitiv · prag {MATCHER_STABLE_FRAMES} cadre consecutive · fără upload
      </p>
    </main>
  );
}
