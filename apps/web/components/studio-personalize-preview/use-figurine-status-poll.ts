"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  readFigurineStatus,
  shouldPollFigurine,
  type FigurineClientError,
  type FigurineStatusView
} from "./generate-figurine";

const POLL_MS = 2500;

/**
 * Poll figurine job status.
 * - `pollEpoch`: bump after a successful POST so the card restarts polling.
 * - `keepAlive`: when true (live stage), never clear the interval while mounted
 *   so a regenerate started from the sibling card is still observed.
 */
export function useFigurineStatusPoll(
  projectId: string | null | undefined,
  pollEpoch = 0,
  keepAlive = false
): {
  status: FigurineStatusView | null;
  error: FigurineClientError | "";
  setStatus: Dispatch<SetStateAction<FigurineStatusView | null>>;
  setError: Dispatch<SetStateAction<FigurineClientError | "">>;
} {
  const [status, setStatus] = useState<FigurineStatusView | null>(null);
  const [error, setError] = useState<FigurineClientError | "">("");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const pull = async () => {
      const result = await readFigurineStatus(projectId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError("");
      setStatus(result.status);
      if (keepAlive) return;
      const terminalFail =
        result.status.job?.status === "error" || result.status.job?.phase === "failed";
      // Card: stop when settled (model ready or failed) and no active job.
      if ((result.status.modelUrl || terminalFail) && !shouldPollFigurine(result.status.job)) {
        stop();
      }
    };

    void pull();
    timer = setInterval(() => void pull(), POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [projectId, pollEpoch, keepAlive]);

  return { status, error, setStatus, setError };
}
