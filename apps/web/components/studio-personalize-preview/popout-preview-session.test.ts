import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname);

function read(file: string) {
  return readFileSync(join(root, file), "utf8");
}

describe("preview pop-out session wiring", () => {
  it("runs cutout and extrusion only in the client mesh stage", () => {
    const poster = read("garden-poster.tsx");
    const mesh = read("popout-mesh-stage.tsx");
    const cutout = read("popout-preview-cutout.ts");
    const normalize = read("popout-preview-normalize.ts");

    expect(poster).toContain('ssr: false');
    expect(poster).toContain("PopoutMeshStage");
    expect(poster).toContain("isPopout && hasDrawing");
    expect(poster).toContain("PopoutFixtureFigure");
    expect(poster).not.toContain("PopoutDrawingStack");

    expect(cutout).toContain('import("@imgly/background-removal")');
    expect(cutout).toContain("alphaMaskFromRgba");
    expect(cutout).toContain("extractSilhouettePolygons");
    expect(normalize).toContain("assignPopoutDepthLayers");
    expect(mesh).toContain("ExtrudeGeometry");
    expect(mesh).toContain("decidePreviewPopout");
    expect(mesh).toContain("showOriginalPage");
    expect(mesh).toContain("plane.visible = pageRef.current");
    expect(mesh).toContain("ShadowMaterial");
    expect(poster).toContain("showOriginalPage");
    expect(mesh).toContain("COPY.popoutPreparing");
    expect(mesh).toContain("COPY.popoutSeparateFailed");
    expect(mesh).toContain("COPY.popoutRetry");
  });

  it("does not write, dispatch a job, or build a GLB", () => {
    const source = [
      read("popout-mesh-stage.tsx"),
      read("popout-preview-cutout.ts"),
      read("popout-preview-normalize.ts"),
      read("garden-poster.tsx")
    ].join("\n");
    expect(source).not.toMatch(/\b(POST|PATCH|PUT|DELETE)\b/);
    expect(source).not.toMatch(/popout_build|GLTFExporter|localStorage|sessionStorage|indexedDB/);
    expect(source).not.toMatch(/\/api\/projects/);
  });
});
