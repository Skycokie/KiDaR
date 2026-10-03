"use client";

import { useRef, useState } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { uploadStudioModelGlb } from "./upload-model-client";

export function UploadModelCard({
  projectId,
  onReady
}: {
  projectId?: string | null;
  onReady?: (previewUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;

  if (!projectId) {
    return <p className="studio-ws__muted">{COPY.uploadNeedsProject}</p>;
  }

  return (
    <div className="studio-ws__figurine-live" data-upload-ready={readyUrl ? "yes" : "no"}>
      <p className="studio-ws__muted">{COPY.uploadDisclosure}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,model/gltf-binary,application/octet-stream"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void (async () => {
            setBusy(true);
            setError(null);
            const result = await uploadStudioModelGlb(projectId, file);
            setBusy(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            const preview = result.uploadModelUrl ?? result.url;
            setReadyUrl(preview);
            onReady?.(preview);
          })();
        }}
      />
      <button
        type="button"
        className="studio-ws__primary-btn"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? COPY.uploadBusy : readyUrl ? COPY.uploadAgain : COPY.uploadPick}
      </button>
      {readyUrl ? <p className="studio-ws__muted">{COPY.uploadReady}</p> : null}
      {error ? (
        <p className="studio-ws__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
