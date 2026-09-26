/** Gentle ease of a relief stepping out of a flat photo. 0 stays in the picture, 1 has emerged. */

export const STARLIT_EMERGE_SECONDS = 3.2;

export type StarlitPhase = "hidden" | "emerging" | "out" | "returning";

export function starlitEmergeAmount(elapsedSeconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const t = Math.min(1, Math.max(0, elapsedSeconds / STARLIT_EMERGE_SECONDS));
  return 1 - (1 - t) ** 3;
}

export function starlitEmergePose(amount: number, idleSeconds: number) {
  const sway = amount >= 1 ? Math.sin(idleSeconds * 0.65) * 0.02 : 0;
  const lift = amount >= 1 ? Math.sin(idleSeconds * 1.05) * 0.015 : 0;
  return {
    /** Toward the camera, in model units. */
    forward: amount * 0.34 + lift,
    /** Starts almost flat in the photo, then tips out so the relief reads as 3D. */
    tilt: 0.03 + amount * 0.22,
    scale: 1 + amount * 0.08,
    sway
  };
}

/** Click on the photo: reveal the scene. Click on the emerged scene: send it back. */
export function starlitNextPhase(
  phase: StarlitPhase,
  target: "photo" | "scene"
): StarlitPhase {
  if (phase === "hidden" && target === "photo") return "emerging";
  if (phase === "out" && target === "scene") return "returning";
  return phase;
}

/** One full turn when the yellow detective is clicked while already out. */
export function shouldHeroSpin(phase: StarlitPhase): boolean {
  return phase === "out";
}
