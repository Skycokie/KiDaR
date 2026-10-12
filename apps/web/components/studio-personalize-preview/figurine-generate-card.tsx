"use client";

import { useState } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { GenerateConfirmDialog } from "./generate-confirm-dialog";
import { shouldPollFigurine, startFigurineGeneration } from "./generate-figurine";
import { CURRENT_GENERATION_COST } from "./generation-cost";
import { useFigurineStatusPoll } from "./use-figurine-status-poll";

export function FigurineGenerateCard({
  projectId,
  hasDrawing,
  drawingSrc = null
}: {
  projectId?: string | null;
  hasDrawing: boolean;
  drawingSrc?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  /** Only reachable from the confirmation dialog, and only with a verified cost. */
  const startGeneration = async () => {
    setBusy(true);
    setError("");
    const result = await startFigurineGeneration(projectId, CURRENT_GENERATION_COST);
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
  };

  return (
    <div className="studio-ws__figurine-live" data-figurine-ready={ready ? "yes" : "no"}>
      <p className="studio-ws__muted">{COPY.figurineDisclosure}</p>
      <button
        type="button"
        className="studio-ws__primary-btn"
        disabled={inFlight || (status !== null && !status.available && !ready && !failed)}
        onClick={() => {
          setError("");
          setConfirmOpen(true);
        }}
      >
        {ready ? COPY.figurineRegenerate : COPY.figurineGenerate}
      </button>
      {confirmOpen ? (
        <GenerateConfirmDialog
          cost={CURRENT_GENERATION_COST}
          drawingSrc={drawingSrc}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            void startGeneration();
          }}
        />
      ) : null}
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
