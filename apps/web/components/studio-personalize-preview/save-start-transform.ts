/**
 * Studio Preview → persisted model start pose + decor for AR.
 *
 * Conversion (deliberate, not a camera dump):
 *   rotation.x = preview pitch
 *   rotation.y = preview yaw
 *   rotation.z = 180  (MindAR image-target baseline; preview roll is not stored)
 * Position and scale come from the project's existing settings, not from zoom.
 * Decor yaw/pitch are converted from Studio radians → degrees for settings.scene.decor.
 */

import { isKnownArDecorId, normalizeArDecorList, studioDecorToArProps } from "@kidar/core";

export type StartSaveStatus = "idle" | "saving" | "saved" | "error";

export type StartSaveCopy = {
  save: string;
  saving: string;
  saved: string;
  failed: string;
  unavailable: string;
  hint: string;
};

export type ArAnchorModeValue = "marker" | "follow";

export type StudioDecorForSave = {
  id: string;
  x: number;
  y: number;
  /** Local GLB orbit yaw in radians (Studio preview). */
  yaw: number;
  /** Local GLB orbit pitch in radians (Studio preview). */
  pitch: number;
};

export type PreviewProjectContext = {
  projectId: string;
  scale: number;
  offset: { x: number; y: number; z: number };
  /** Model rotation.y / rotation.x. Stored z is ignored by the orbit UI. */
  startYaw: number | null;
  startPitch: number | null;
  /** Persisted AR anchor after image detect. Missing/invalid → marker. */
  arAnchorMode: ArAnchorModeValue;
  /** Persisted AR-capable decor (radians, Studio units). Empty when none saved. */
  decor: StudioDecorForSave[];
};

/** Safe parse for project settings.scene.arAnchorMode. Never throws. */
export function parseArAnchorMode(value: unknown): ArAnchorModeValue {
  return value === "follow" ? "follow" : "marker";
}

/** Only decor with an AR GLB is persisted; Studio-only props stay local. */
export function persistableStudioDecor(decor: StudioDecorForSave[] | undefined): StudioDecorForSave[] {
  return (decor ?? []).filter((item) => isKnownArDecorId(item.id));
}

/** settings.scene.decor (degrees) → Studio decor (radians) for hydration after reload. */
export function persistedDecorToStudio(raw: unknown): StudioDecorForSave[] {
  return normalizeArDecorList(raw).map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    yaw: (item.yaw * Math.PI) / 180,
    pitch: (item.pitch * Math.PI) / 180
  }));
}

export function buildStartTransformPatch(input: {
  yaw: number;
  pitch: number;
  offset: { x: number; y: number; z: number };
  scale: number;
  arAnchorMode?: ArAnchorModeValue;
  decor?: StudioDecorForSave[];
}) {
  return {
    settings: {
      scene: {
        arAnchorMode: parseArAnchorMode(input.arAnchorMode),
        startTransform: {
          rotation: { x: input.pitch, y: input.yaw, z: 180 as const },
          position: { x: input.offset.x, y: input.offset.y, z: input.offset.z },
          scale: input.scale
        },
        decor: studioDecorToArProps(persistableStudioDecor(input.decor))
      }
    }
  };
}

function decorSignature(decor: StudioDecorForSave[]): string {
  return persistableStudioDecor(decor)
    .map(
      (d) =>
        `${d.id}:${Math.round(d.x * 10)}:${Math.round(d.y * 10)}:${Math.round(d.yaw * 1000)}:${Math.round(d.pitch * 1000)}`
    )
    .join("|");
}

export function isStartPoseDirty(
  current: {
    yaw: number;
    pitch: number;
    arAnchorMode: ArAnchorModeValue;
    decor?: StudioDecorForSave[];
  },
  baseline: {
    yaw: number;
    pitch: number;
    arAnchorMode: ArAnchorModeValue;
    decor?: StudioDecorForSave[];
  }
): boolean {
  return (
    Math.abs(current.yaw - baseline.yaw) > 1e-4 ||
    Math.abs(current.pitch - baseline.pitch) > 1e-4 ||
    current.arAnchorMode !== baseline.arAnchorMode ||
    decorSignature(current.decor ?? []) !== decorSignature(baseline.decor ?? [])
  );
}

export function startSavePresentation(input: {
  hasProject: boolean;
  dirty: boolean;
  status: StartSaveStatus;
  copy: StartSaveCopy;
}): { label: string; disabled: boolean; hint: string | null } {
  const copy = input.copy;
  if (!input.hasProject) {
    return { label: copy.unavailable, disabled: true, hint: null };
  }
  if (input.status === "saving") {
    return { label: copy.saving, disabled: true, hint: null };
  }
  if (input.status === "error") {
    return { label: copy.failed, disabled: false, hint: null };
  }
  if (!input.dirty && input.status === "saved") {
    return { label: copy.saved, disabled: true, hint: copy.hint };
  }
  return { label: copy.save, disabled: !input.dirty, hint: null };
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
