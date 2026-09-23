"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  FIGURINE_DISCLOSURE_RO,
  type ProjectSettings,
  type SilhouetteStats
} from "@kidar/core";
import { ThreePreview } from "./three-preview";
import "./studio-client.css";

type Mode = "popout" | "gallery" | "upload" | "figurine_3d";
type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  mode: Mode;
  status: string;
  settings: ProjectSettings;
};
type GalleryModel = { id: string; name: string; thumbnailUrl: string | null; glbUrl: string | null };

type FigurineStatusResponse = {
  availability: { available: boolean; reason: string; message: string };
  disclosure: string;
  figurineModelUrl: string | null;
  job: {
    id: string;
    status: string;
    phase?: string;
    progress: number;
    label: string;
    publicUrl: string | null;
    failureMessage?: string | null;
  } | null;
};

const defaultSettings: ProjectSettings = {
  title: "",
  theme: "#6d5dfc",
  scale: 1,
  offset: { x: 0, y: 0, z: 0 }
};

export function StudioClient({
  project: initialProject,
  sourceUrl: initialSourceUrl,
  assetUrls,
  plan
}: {
  project: ProjectRecord;
  sourceUrl: string | null;
  assetUrls: Record<string, string>;
  plan: "free" | "paid";
}) {
  const [project, setProject] = useState(initialProject);
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [settings, setSettings] = useState<ProjectSettings>({
    ...defaultSettings,
    ...initialProject.settings,
    offset: { ...defaultSettings.offset, ...initialProject.settings?.offset },
    galleryModelUrl: initialProject.settings?.galleryModelUrl ?? undefined,
    figurineModelUrl: initialProject.settings?.figurineModelUrl ?? undefined,
    uploadModelUrl: assetUrls.uploadModelUrl ?? initialProject.settings?.uploadModelUrl,
    logoPath: initialProject.settings?.logoPath,
    soundPath: initialProject.settings?.soundPath
  });
  const [mode, setMode] = useState<Mode>(initialProject.mode);
  const [lastSaved, setLastSaved] = useState("Saved");
  const [popoutStats, setPopoutStats] = useState<SilhouetteStats | null>(null);
  const [notice, setNotice] = useState("");
  const [galleryQuery, setGalleryQuery] = useState("");
  const [galleryModels, setGalleryModels] = useState<GalleryModel[]>([]);
  const [searchingGallery, setSearchingGallery] = useState(false);
  const [figurineStatus, setFigurineStatus] = useState<FigurineStatusResponse | null>(null);
  const [figurineStatusLoading, setFigurineStatusLoading] = useState(true);
  const [figurineBusy, setFigurineBusy] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [lifeChoice, setLifeChoice] = useState<"popout" | "figurine_3d" | null>(
    initialProject.mode === "figurine_3d"
      ? "figurine_3d"
      : initialProject.mode === "popout"
        ? "popout"
        : null
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettings = useRef(settings);
  const handlePopoutStats = useCallback((stats: SilhouetteStats) => {
    setPopoutStats(stats);
  }, []);

  const saveSettings = useCallback(
    (patch: Partial<ProjectSettings>) => {
      const nextSettings = {
        ...pendingSettings.current,
        ...patch,
        offset: { ...pendingSettings.current.offset, ...(patch.offset ?? {}) }
      };
      pendingSettings.current = nextSettings;
      setSettings(nextSettings);
      setLastSaved("Saving…");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ settings: pendingSettings.current })
        });
        setLastSaved(response.ok ? "Saved" : "Save failed");
      }, 500);
    },
    [project.id]
  );

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (project.status !== "processing") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/projects/${project.id}`);
      if (!response.ok) return;
      const body = (await response.json()) as { project: ProjectRecord };
      setProject(body.project);
      setSettings((current) => {
        const incoming = body.project.settings;
        if (!incoming) return current;
        const nextOffset = {
          x: incoming.offset?.x ?? current.offset.x,
          y: incoming.offset?.y ?? current.offset.y,
          z: incoming.offset?.z ?? current.offset.z
        };
        const next = {
          ...current,
          ...incoming,
          offset: nextOffset
        };
        // Skip identity churn when poll returns the same settings payload.
        if (
          next.scale === current.scale &&
          next.figurineModelUrl === current.figurineModelUrl &&
          next.galleryModelUrl === current.galleryModelUrl &&
          next.uploadModelUrl === current.uploadModelUrl &&
          nextOffset.x === current.offset.x &&
          nextOffset.y === current.offset.y &&
          nextOffset.z === current.offset.z &&
          next.title === current.title &&
          next.theme === current.theme
        ) {
          return current;
        }
        pendingSettings.current = next;
        return next;
      });
      if (body.project.status === "ready") setNotice("Publish ready.");
      if (body.project.status === "error") setNotice("Publish failed.");
    }, 2000);
    return () => clearInterval(timer);
  }, [project.id, project.status]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFigurineStatusLoading(true);
      try {
        const [featureRes, statusRes] = await Promise.all([
          fetch("/api/features/figurine-3d"),
          fetch(`/api/projects/${project.id}/figurine`)
        ]);
        if (cancelled) return;
        if (featureRes.ok) {
          const featureBody = (await featureRes.json()) as {
            enabled?: boolean;
            available?: boolean;
          };
          setFeatureEnabled(Boolean(featureBody.enabled && featureBody.available));
        } else {
          setFeatureEnabled(false);
        }
        if (statusRes.ok) {
          const body = (await statusRes.json()) as FigurineStatusResponse;
          setFigurineStatus(body);
          if (body.figurineModelUrl) {
            setSettings((current) => {
              if (current.figurineModelUrl === body.figurineModelUrl) return current;
              const next = { ...current, figurineModelUrl: body.figurineModelUrl ?? undefined };
              pendingSettings.current = next;
              return next;
            });
          }
        }
      } finally {
        if (!cancelled) setFigurineStatusLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (mode !== "figurine_3d" && lifeChoice !== "figurine_3d") return;

    const jobFinished =
      figurineStatus?.job?.status === "done" ||
      figurineStatus?.job?.status === "error" ||
      figurineStatus?.job?.phase === "ready" ||
      figurineStatus?.job?.phase === "failed";
    // Keep polling only while a build is in flight; ready/failed stop the 2.5s tick.
    if (jobFinished) return;

    let cancelled = false;
    const poll = async () => {
      const response = await fetch(`/api/projects/${project.id}/figurine`);
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as FigurineStatusResponse;
      if (cancelled) return;
      setFigurineStatus(body);
      setFigurineStatusLoading(false);
      if (body.figurineModelUrl) {
        setSettings((current) => {
          if (current.figurineModelUrl === body.figurineModelUrl) return current;
          const next = { ...current, figurineModelUrl: body.figurineModelUrl ?? undefined };
          pendingSettings.current = next;
          return next;
        });
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode, lifeChoice, project.id, project.status, figurineStatus?.job?.status, figurineStatus?.job?.phase]);

  const hasIsolatedSource = Boolean(sourceUrl);
  const figurineCard = useMemo(() => {
    if (figurineStatusLoading || featureEnabled === null) {
      return {
        disabled: true,
        message: "Se verifică disponibilitatea…"
      };
    }
    if (!featureEnabled) {
      return {
        disabled: true,
        message: "În curând"
      };
    }
    if (!hasIsolatedSource) {
      return {
        disabled: true,
        message:
          "Pentru Figurină 3D, alege sau decupează un singur personaj, animal ori obiect."
      };
    }
    if (figurineStatus && !figurineStatus.availability.available) {
      return {
        disabled: mode !== "figurine_3d",
        message: figurineStatus.availability.message
      };
    }
    return { disabled: false, message: "" };
  }, [
    figurineStatusLoading,
    featureEnabled,
    hasIsolatedSource,
    figurineStatus,
    mode
  ]);
  async function startFigurine() {
    setFigurineBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${project.id}/figurine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true })
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body.message ?? body.error ?? "Nu am putut porni Figurină 3D.");
        return;
      }
      setMode("figurine_3d");
      setLifeChoice("figurine_3d");
      setProject((current) => ({ ...current, mode: "figurine_3d", status: "processing" }));
      setNotice(body.label ?? "În pregătire");
    } finally {
      setFigurineBusy(false);
    }
  }

  async function choosePopout() {
    setLifeChoice("popout");
    setMode("popout");
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "popout" })
    });
  }

  useEffect(() => {
    if (!galleryQuery.trim()) {
      setGalleryModels([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingGallery(true);
      const response = await fetch(`/api/gallery?query=${encodeURIComponent(galleryQuery)}`);
      const body = await response.json();
      setGalleryModels(body.models ?? []);
      setSearchingGallery(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [galleryQuery]);

  async function uploadSource(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/projects/${project.id}/source`, {
      method: "POST",
      body: formData
    });
    const body = await response.json();
    if (!response.ok) {
      setNotice(body.error);
      return;
    }
    setSourceUrl(body.sourceUrl);
    setProject(body.project);
    setNotice("Drawing uploaded.");
  }

  async function uploadAsset(kind: "model" | "logo" | "sound", file: File) {
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", file);
    const response = await fetch(`/api/projects/${project.id}/asset`, {
      method: "POST",
      body: formData
    });
    const body = await response.json();
    if (!response.ok) {
      setNotice(body.error);
      return;
    }
    saveSettings(
      kind === "model"
        ? { uploadModelPath: body.path, uploadModelUrl: body.url }
        : kind === "logo"
          ? { logoPath: body.path }
          : { soundPath: body.path, soundUrl: body.url }
    );
    setNotice(`${kind} uploaded.`);
  }

  async function publish() {
    const response = await fetch("/api/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id })
    });
    const body = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setNotice(body.error ?? "Publish failed.");
      return;
    }
    setProject((current) => ({ ...current, status: "processing" }));
    setNotice(body.message ?? "Publish queued.");
  }

  const sourceDropzone = useDropzone({
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    multiple: false,
    onDrop: (files) => {
      const file = files[0];
      if (file) void uploadSource(file);
    }
  });

  const modelDropzone = useDropzone({
    accept: { "model/gltf-binary": [".glb"] },
    multiple: false,
    onDrop: (files) => {
      const file = files[0];
      if (file) void uploadAsset("model", file);
    }
  });

  const sourceLabel = useMemo(
    () => (sourceUrl ? "Replace drawing" : "Drop a PNG or JPG here"),
    [sourceUrl]
  );

  return (
    <main className="studio-shell">
      <header>
        <p><a href="/studio">← Studio</a></p>
        <h1>{project.name}</h1>
        <p>/{project.slug} · {lastSaved}</p>
      </header>
      <div className="studio-grid">
        <section
          className={`preview-panel${mode === "figurine_3d" ? " preview-panel--figurine" : ""}`}
          aria-label="AR preview"
        >
          <ThreePreview
            sourceUrl={sourceUrl}
            mode={mode}
            settings={settings}
            onPopoutStats={handlePopoutStats}
          />
          {popoutStats && (
            <output data-testid="popout-stats">
              {JSON.stringify(popoutStats)}
            </output>
          )}
        </section>
        <aside className="inspector">
          <details open>
            <summary>Source</summary>
            <div {...sourceDropzone.getRootProps()} className="dropzone">
              <input {...sourceDropzone.getInputProps()} />
              <p>{sourceLabel}</p>
              {sourceUrl && <img src={sourceUrl} alt="Drawing thumbnail" style={{ maxWidth: "100%", maxHeight: 120 }} />}
            </div>
          </details>

          <details open>
            <summary>Cum vrei să prindă viață?</summary>
            <div className="life-choice" style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                aria-pressed={lifeChoice === "popout" || mode === "popout"}
                onClick={() => void choosePopout()}
                style={{ textAlign: "left", padding: 12 }}
              >
                <strong>Pop-out din desen</strong>
                <br />
                Relief rapid, fidel desenului tău.
              </button>
              <button
                type="button"
                aria-pressed={lifeChoice === "figurine_3d" || mode === "figurine_3d"}
                disabled={figurineCard.disabled}
                onClick={() => {
                  if (figurineCard.disabled) return;
                  setLifeChoice("figurine_3d");
                }}
                style={{ textAlign: "left", padding: 12 }}
              >
                <strong>Figurină 3D</strong>
                <br />
                Personaje ilustrate care pot fi privite din toate părțile.
                {figurineCard.message ? <p role="status">{figurineCard.message}</p> : null}
              </button>
            </div>
            {(lifeChoice === "figurine_3d" || mode === "figurine_3d") && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <p>{FIGURINE_DISCLOSURE_RO}</p>
                {sourceUrl ? (
                  <p>
                    Sursă selectată: <img src={sourceUrl} alt="" style={{ maxHeight: 48, verticalAlign: "middle" }} />{" "}
                    personaj izolat
                  </p>
                ) : (
                  <p>
                    Pentru Figurină 3D, alege sau decupează un singur personaj, animal ori obiect.
                  </p>
                )}
                <button
                  type="button"
                  disabled={
                    figurineBusy ||
                    figurineCard.disabled ||
                    !sourceUrl ||
                    (figurineStatus !== null && !figurineStatus.availability.available)
                  }
                  onClick={() => void startFigurine()}
                >
                  Generează Figurină 3D
                </button>
                {figurineStatus?.job ? (
                  <p role="status">
                    {figurineStatus.job.label}
                    {figurineStatus.job.progress > 0 ? ` · ${figurineStatus.job.progress}%` : ""}
                  </p>
                ) : null}
                {figurineStatus?.job?.status === "error" ||
                figurineStatus?.job?.phase === "failed" ? (
                  <div>
                    <p role="alert">
                      {figurineStatus.job.failureMessage ?? "Nu am reușit să generăm figurina"}
                    </p>
                    <button type="button" onClick={() => void choosePopout()}>
                      Încearcă Pop-out din desen
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </details>

          <details open>
            <summary>3D Mode</summary>
            <div className="segmented">
              {(["popout", "gallery", "upload", "figurine_3d"] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  aria-pressed={mode === nextMode}
                  onClick={() => {
                    setMode(nextMode);
                    if (nextMode === "popout" || nextMode === "figurine_3d") {
                      setLifeChoice(nextMode);
                    }
                    void fetch(`/api/projects/${project.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ mode: nextMode })
                    });
                  }}
                >
                  {nextMode === "popout"
                    ? "Pop-out"
                    : nextMode === "figurine_3d"
                      ? "Figurină 3D"
                      : nextMode[0].toUpperCase() + nextMode.slice(1)}
                </button>
              ))}
            </div>
            {mode === "gallery" && (
              <>
                <div className="control">
                  <label htmlFor="gallery-search">Search Poly Pizza</label>
                  <input id="gallery-search" value={galleryQuery} onChange={(event) => setGalleryQuery(event.target.value)} />
                </div>
                {searchingGallery && <p>Searching…</p>}
                <div className="model-grid">
                  {galleryModels.map((model) => (
                    <button
                      type="button"
                      key={model.id}
                      data-testid={`gallery-model-${model.id}`}
                      aria-pressed={settings.galleryModelUrl === model.glbUrl}
                      onClick={() => saveSettings({ galleryModelUrl: model.glbUrl ?? undefined })}
                      disabled={!model.glbUrl}
                    >
                      {model.thumbnailUrl && <img src={model.thumbnailUrl} alt="" />}
                      {model.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            {mode === "upload" && (
              <div {...modelDropzone.getRootProps()} className="dropzone">
                <input {...modelDropzone.getInputProps()} />
                Drop a .glb model or click to browse
              </div>
            )}
          </details>

          <details open>
            <summary>Transform</summary>
            <div className="control">
              <label htmlFor="scale">Scale: {settings.scale.toFixed(2)}</label>
              <input id="scale" type="range" min="0.25" max="3" step="0.05" value={settings.scale} onChange={(event) => saveSettings({ scale: Number(event.target.value) })} />
            </div>
            <div className="segmented">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()}
                  <input
                    type="number"
                    step="0.05"
                    value={settings.offset[axis]}
                    onChange={(event) =>
                      saveSettings({
                        offset: { ...settings.offset, [axis]: Number(event.target.value) }
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>

          <details open>
            <summary>Branding</summary>
            <div className="control">
              <label htmlFor="title">Title</label>
              <input id="title" value={settings.title} onChange={(event) => saveSettings({ title: event.target.value })} />
            </div>
            <div className="control">
              <label htmlFor="theme">Accent color</label>
              <input id="theme" type="color" value={settings.theme} onChange={(event) => saveSettings({ theme: event.target.value })} />
            </div>
            <div className="control">
              <label title={plan === "free" ? "Upgrade to unlock logos" : undefined}>
                Logo {plan === "free" && "🔒 Paid plan"}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" disabled={plan === "free"} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAsset("logo", file);
                }} />
              </label>
            </div>
            <div className="control">
              <label htmlFor="cta-text">CTA text</label>
              <input id="cta-text" value={settings.ctaText ?? ""} onChange={(event) => saveSettings({ ctaText: event.target.value })} />
            </div>
            <div className="control">
              <label htmlFor="cta-url">CTA URL</label>
              <input id="cta-url" type="url" value={settings.ctaUrl ?? ""} onChange={(event) => saveSettings({ ctaUrl: event.target.value })} />
            </div>
            <div className="control">
              <label>
                Sound (MP3, max 1 MB)
                <input type="file" accept="audio/mpeg,audio/mp3" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAsset("sound", file);
                }} />
              </label>
            </div>
          </details>

          <button type="button" onClick={() => void publish()}>Publish experience</button>
          {project.status === "processing" ? <p role="status">Processing…</p> : null}
          {project.status === "ready" && settings.publicQrUrl && settings.publicPdfUrl ? (
            <div>
              {settings.publicExperienceUrl ? (
                <p>
                  <a href={settings.publicExperienceUrl}>Open experience</a>
                </p>
              ) : null}
              <p>
                <a href={settings.publicQrUrl}>Download QR</a>
              </p>
              <p>
                <a href={settings.publicPdfUrl}>Download PDF</a>
              </p>
            </div>
          ) : null}
          {notice && <p role="status">{notice}</p>}
        </aside>
      </div>
    </main>
  );
}
