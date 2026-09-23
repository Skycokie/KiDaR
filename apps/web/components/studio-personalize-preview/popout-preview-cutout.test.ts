import { describe, expect, it } from "vitest";
import {
  DESKTOP_POPOUT_MAX_EDGE,
  fittedEdgeSize,
  MOBILE_POPOUT_MAX_EDGE,
  previewProcessMaxEdge
} from "./popout-preview-cutout";

describe("preview pop-out source fit", () => {
  it("caps the long edge and keeps the aspect ratio", () => {
    expect(fittedEdgeSize(3000, 1500, MOBILE_POPOUT_MAX_EDGE)).toEqual({ width: 1024, height: 512 });
    expect(fittedEdgeSize(800, 1200, MOBILE_POPOUT_MAX_EDGE)).toEqual({ width: 683, height: 1024 });
    expect(fittedEdgeSize(640, 480, MOBILE_POPOUT_MAX_EDGE)).toEqual({ width: 640, height: 480 });
    expect(fittedEdgeSize(4000, 3000, DESKTOP_POPOUT_MAX_EDGE)).toEqual({ width: 2048, height: 1536 });
  });

  it("uses 1024 on a phone viewport and 2048 on a wide viewport", () => {
    expect(previewProcessMaxEdge(390)).toBe(MOBILE_POPOUT_MAX_EDGE);
    expect(previewProcessMaxEdge(959)).toBe(MOBILE_POPOUT_MAX_EDGE);
    expect(previewProcessMaxEdge(960)).toBe(DESKTOP_POPOUT_MAX_EDGE);
    expect(previewProcessMaxEdge(1440)).toBe(DESKTOP_POPOUT_MAX_EDGE);
  });
});
