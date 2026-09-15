"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { ProjectSettings, SilhouetteStats } from "@kidar/core";
import { ThreePreview } from "./three-preview";

type Mode = "popout" | "gallery" | "upload";
type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  mode: Mode;
  status: string;
  settings: ProjectSettings;
};
type GalleryModel = { id: string; name: string; thumbnailUrl: string | null; glbUrl: string | null };

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
    const body = await response.json();
    setNotice(response.ok ? "Publish queued." : body.error);
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
      <style>{`
        .studio-shell { min-height: 100vh; padding: 20px; background: #faf9ff; }
        .studio-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 420px); gap: 20px; max-width: 1440px; margin: 0 auto; }
        .preview-panel { min-height: 80vh; border-radius: 20px; overflow: hidden; background: #f4f1ff; position: sticky; top: 20px; }
        .inspector { display: grid; gap: 12px; align-content: start; }
        .inspector details { background: white; border: 1px solid #e5e1f2; border-radius: 12px; padding: 14px; }
        .inspector details[open] summary { margin-bottom: 12px; }
        .inspector summary { cursor: pointer; font-weight: 700; }
        .control { display: grid; gap: 6px; margin-top: 10px; }
        .control input, .control textarea, .control select { width: 100%; box-sizing: border-box; padding: 8px; }
        .segmented { display: flex; gap: 6px; flex-wrap: wrap; }
        .segmented button[aria-pressed="true"] { background: #6d5dfc; color: white; }
        .dropzone { border: 1px dashed #8d83c7; padding: 18px; border-radius: 10px; cursor: pointer; text-align: center; }
        .model-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; }
        .model-grid button { text-align: left; padding: 6px; }
        .model-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; }
        @media (max-width: 800px) { .studio-grid { grid-template-columns: 1fr; } .preview-panel { min-height: 55vh; position: relative; top: 0; } }
      `}</style>
      <header>
        <p><a href="/dashboard">← Dashboard</a></p>
        <h1>{project.name}</h1>
        <p>/{project.slug} · {lastSaved}</p>
      </header>
      <div className="studio-grid">
        <section className="preview-panel" aria-label="AR preview">
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
            <summary>3D Mode</summary>
            <div className="segmented">
              {(["popout", "gallery", "upload"] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  aria-pressed={mode === nextMode}
                  onClick={() => {
                    setMode(nextMode);
                    void fetch(`/api/projects/${project.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ mode: nextMode })
                    });
                  }}
                >
                  {nextMode === "popout" ? "Pop-out" : nextMode[0].toUpperCase() + nextMode.slice(1)}
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
          {notice && <p role="status">{notice}</p>}
        </aside>
      </div>
    </main>
  );
}
