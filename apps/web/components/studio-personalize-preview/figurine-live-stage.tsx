"use client";

import type { ReactNode } from "react";
import { useStudioI18n } from "@/components/i18n/studio-i18n";
import { FigurineGlbStage } from "./figurine-glb-stage";
import { shouldPollFigurine } from "./generate-figurine";
import { useFigurineStatusPoll } from "./use-figurine-status-poll";

/**
 * Loads the owner Tripo figurine into the personalize stage.
 * Falls back to the local clay mock until a GLB exists.
 * Keeps polling until a model URL arrives or the job fails — including after
 * a regenerate click that happened while the stage was already mounted.
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
  // keepAlive: observe regenerates started from FigurineGenerateCard.
  const { status } = useFigurineStatusPoll(projectId, 0, true);
  const { messages } = useStudioI18n();
  const COPY = messages.personalize;

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
