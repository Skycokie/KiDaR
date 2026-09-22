/**
 * Studio Preview → persisted model start pose.
 *
 * Conversion (deliberate, not a camera dump):
 *   rotation.x = preview pitch
 *   rotation.y = preview yaw
 *   rotation.z = 180  (MindAR image-target baseline; preview roll is not stored)
 * Position and scale come from the project's existing settings, not from zoom.
 */

export type StartSaveStatus = "idle" | "saving" | "saved" | "error";

export const START_SAVE_COPY = {
  save: "Salvează poziția de start",
  saving: "Se salvează…",
  saved: "Poziție salvată ✓",
  failed: "Nu s-a salvat. Încearcă din nou",
  unavailable: "Salvarea e disponibilă după ce creezi lumea",
  hint: "Va fi folosită la următoarea publicare."
} as const;

export type PreviewProjectContext = {
  projectId: string;
  scale: number;
  offset: { x: number; y: number; z: number };
  /** Model rotation.y / rotation.x. Stored z is ignored by the orbit UI. */
  startYaw: number | null;
  startPitch: number | null;
};

export function buildStartTransformPatch(input: {
  yaw: number;
  pitch: number;
  offset: { x: number; y: number; z: number };
  scale: number;
}) {
  return {
    settings: {
      scene: {
        startTransform: {
          rotation: { x: input.pitch, y: input.yaw, z: 180 as const },
          position: { x: input.offset.x, y: input.offset.y, z: input.offset.z },
          scale: input.scale
        }
      }
    }
  };
}

export function isStartPoseDirty(
  current: { yaw: number; pitch: number },
  baseline: { yaw: number; pitch: number }
): boolean {
  return Math.abs(current.yaw - baseline.yaw) > 1e-4 || Math.abs(current.pitch - baseline.pitch) > 1e-4;
}

export function startSavePresentation(input: {
  hasProject: boolean;
  dirty: boolean;
  status: StartSaveStatus;
}): { label: string; disabled: boolean; hint: string | null } {
  if (!input.hasProject) {
    return { label: START_SAVE_COPY.unavailable, disabled: true, hint: null };
  }
  if (input.status === "saving") {
    return { label: START_SAVE_COPY.saving, disabled: true, hint: null };
  }
  if (input.status === "error") {
    return { label: START_SAVE_COPY.failed, disabled: false, hint: null };
  }
  if (!input.dirty && input.status === "saved") {
    return { label: START_SAVE_COPY.saved, disabled: true, hint: START_SAVE_COPY.hint };
  }
  return { label: START_SAVE_COPY.save, disabled: !input.dirty, hint: null };
}

export async function patchStartTransform(
  projectId: string,
  body: ReturnType<typeof buildStartTransformPatch>
): Promise<boolean> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.ok;
}
