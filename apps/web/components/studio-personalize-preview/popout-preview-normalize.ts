/**
 * Browser-safe pop-out decision for Studio Preview.
 * Layer assignment stays in @kidar/core (`assignPopoutDepthLayers` / `filterPopoutComponents`).
 * No canvas, Three, @imgly, filesystem, or network.
 */
import {
  POPOUT_COVERAGE_REJECT,
  POPOUT_DEPTH_LEVELS,
  POPOUT_EXTRUDE,
  assignPopoutDepthLayers,
  type DepthScoredPolygon,
  type StickerPolygon
} from "@kidar/core";

export type PreviewPopoutDecision =
  | { kind: "fallback"; reason: "empty" | "full-page" }
  | { kind: "layers"; layers: DepthScoredPolygon[] };

/**
 * Empty / invalid masks and near-full-page coverage never become a rectangle extrusion.
 * Valid components keep the core pipeline's discrete depth layers.
 */
export function decidePreviewPopout(
  polygons: StickerPolygon[] | null | undefined,
  coverage: number | null | undefined
): PreviewPopoutDecision {
  if (!polygons?.length || coverage == null || !Number.isFinite(coverage)) {
    return { kind: "fallback", reason: "empty" };
  }
  if (coverage >= POPOUT_COVERAGE_REJECT) {
    return { kind: "fallback", reason: "full-page" };
  }
  const layers = assignPopoutDepthLayers(polygons);
  if (!layers.length) return { kind: "fallback", reason: "empty" };
  return { kind: "layers", layers };
}

/**
 * Volum changes only local extrusion depth and Z separation.
 * It does not reassign which component sits on which discrete layer.
 */
export function previewVolumeDepth(volume: number): { depth: number; zScale: number } {
  const t = Math.min(100, Math.max(0, volume)) / 100;
  return {
    depth: POPOUT_EXTRUDE.depth * (0.42 + t * 1.45),
    zScale: 1 + t * 7
  };
}

export function previewLayerZ(baseZ: number, volume: number): number {
  return baseZ * previewVolumeDepth(volume).zScale;
}

export { POPOUT_DEPTH_LEVELS };
