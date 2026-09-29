/** Local GLB paths for Studio decor props (Meshy). */
import type { DecorId } from "./fixtures";

export const DECOR_GLB_SRC: Record<DecorId, string> = {
  cloud: "/demo/glb/decor/cloud.glb",
  stars: "/demo/glb/decor/stars.glb",
  grass: "/demo/glb/decor/grass.glb",
  tree: "/demo/glb/decor/tree.glb",
  house: "/demo/glb/decor/house.glb",
  planet: "/demo/glb/decor/planet.glb",
  balloons: "/demo/glb/decor/balloons.glb",
  /** Pose figurines from the former Mișcare set (3 characters × poses). */
  figureWave: "/demo/glb/motion/wave.glb",
  figureFloat: "/demo/glb/motion/float.glb",
  figureDance: "/demo/glb/motion/dance.glb",
  figureJump: "/demo/glb/motion/jump.glb",
  figureStill: "/demo/glb/motion/still.glb",
  figureFollow: "/demo/glb/motion/follow.glb"
};

/**
 * Decor ids that ship a Meshy GLB in this deploy bundle.
 * Empty until compressed/CDN-approved binaries are committed or hosted.
 * Missing files must not be advertised as available.
 */
export const DECOR_GLB_AVAILABLE = new Set<DecorId>([]);

export function decorGlbAvailable(id: DecorId): boolean {
  return DECOR_GLB_AVAILABLE.has(id);
}
