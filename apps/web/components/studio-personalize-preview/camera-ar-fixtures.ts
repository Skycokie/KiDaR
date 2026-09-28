/**
 * AR camera preview Go B — simulated states only.
 * No device camera, no tracking, no real project data.
 * Copy lives in `messages.cameraAr`.
 */

export const CAMERA_AR_STUDIO_HREF = "/studio-preview/personalizeaza";

export type CameraArPhase =
  | "intro"
  | "preparing"
  | "searching"
  | "found"
  | "lost"
  | "unavailable"
  | "incompatible";

/** Fixed decorative overlay for found state — independent of Studio React state. */
export const CAMERA_AR_FIXTURE_OVERLAY = {
  character: "butterfly" as const,
  effect: "stars" as const,
  atmosphere: "sunset" as const
};
