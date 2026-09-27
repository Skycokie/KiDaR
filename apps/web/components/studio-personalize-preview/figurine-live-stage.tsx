"use client";

import { useEffect, useState, type ReactNode } from "react";
import { COPY } from "./fixtures";
import { FigurineGlbStage } from "./figurine-glb-stage";
import {
  readFigurineStatus,
  shouldPollFigurine,
  type FigurineStatusView
} from "./generate-figurine";

/**
 * Loads the owner Tripo figurine into the personalize stage.
 * Falls back to the local clay mock until a GLB exists.
 */
export function FigurineLiveStage({
  projectId,
  yaw,
  pitch,
  roll,
  zoom,
  volume,
  fallback
}: {
  projectId: string;
  yaw: number;
  pitch: number;
  roll: number;
  zoom: number;
  volume: number;
  fallback: ReactNode;
}) {
  const [status, setStatus] = useState<FigurineStatusView | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pull = async () => {
      const result = await readFigurineStatus(projectId);
      if (cancelled || !result.ok) return;
      setStatus(result.status);
      if (!shouldPollFigurine(result.status.job) && timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    void pull();
    timer = setInterval(() => void pull(), 2500);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [projectId]);

  if (status?.modelUrl) {
    return (
      <div className="studio-stage__figurine-live" data-figurine-phase="ready">
        <FigurineGlbStage
          modelUrl={status.modelUrl}
          yaw={yaw}
          pitch={pitch}
          roll={roll}
          zoom={zoom}
          volume={volume}
        />
      </div>
    );
  }

  const preparing = shouldPollFigurine(status?.job ?? null);
  return (
    <div className="studio-stage__figurine-pending" data-figurine-phase={preparing ? "preparing" : "mock"}>
      {fallback}
      {preparing ? (
        <p className="studio-stage__popout-status" role="status">
          {status?.job?.label || COPY.figurinePreparing}
          {status?.job && status.job.progress > 0 ? ` · ${status.job.progress}%` : ""}
        </p>
      ) : null}
    </div>
  );
}
