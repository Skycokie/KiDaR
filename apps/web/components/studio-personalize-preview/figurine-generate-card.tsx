"use client";

import { useState } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { shouldPollFigurine, startFigurineGeneration } from "./generate-figurine";
import { useFigurineStatusPoll } from "./use-figurine-status-poll";

export function FigurineGenerateCard({
  projectId,
  hasDrawing
}: {
  projectId?: string | null;
  hasDrawing: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);
  const { status, error, setStatus, setError } = useFigurineStatusPoll(projectId, pollEpoch);
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;

  if (!projectId) {
    return <p className="studio-ws__muted">{COPY.figurineNeedsProject}</p>;
  }
  if (!hasDrawing) {
    return <p className="studio-ws__muted">{COPY.figurineNeedsDrawing}</p>;
  }

  const inFlight = busy || shouldPollFigurine(status?.job ?? null);
  const ready = Boolean(status?.modelUrl);
  const failed = status?.job?.status === "error" || status?.job?.phase === "failed";

  return (
    <div className="studio-ws__figurine-live" data-figurine-ready={ready ? "yes" : "no"}>
      <p className="studio-ws__muted">{COPY.figurineDisclosure}</p>
      <button
        type="button"
        className="studio-ws__primary-btn"
        disabled={inFlight || (status !== null && !status.available && !ready && !failed)}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setError("");
            const result = await startFigurineGeneration(projectId);
            setBusy(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setStatus((current) => ({
              available: current?.available ?? true,
              message: current?.message ?? "",
              modelUrl: current?.modelUrl ?? null,
              job: {
                status: "queued",
                phase: "queued",
                progress: 0,
                label: result.label,
                publicUrl: null
              }
            }));
            // Restart the poll loop — a prior idle GET may have cleared the interval.
            setPollEpoch((epoch) => epoch + 1);
          })();
        }}
      >
        {ready ? COPY.figurineRegenerate : COPY.figurineGenerate}
      </button>
      {status?.job ? (
        <p role="status">
          {status.job.label}
          {status.job.progress > 0 ? ` · ${status.job.progress}%` : ""}
        </p>
      ) : null}
      {error ? <p role="alert">{COPY.figurineErrors[error]}</p> : null}
      {failed && status?.job?.failureMessage ? <p role="alert">{status.job.failureMessage}</p> : null}
      {status && !status.available && status.message ? <p role="status">{status.message}</p> : null}
    </div>
  );
}
