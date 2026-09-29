import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODE_PREVIEW_ASSETS } from "./mode-preview-icons";

const iconsSource = readFileSync(join(__dirname, "mode-preview-icons.tsx"), "utf8");
const popoutThumbSource = readFileSync(join(__dirname, "mode-popout-thumb.tsx"), "utf8");
const cutoutSource = readFileSync(join(__dirname, "popout-preview-cutout.ts"), "utf8");
const extrudeSource = readFileSync(join(__dirname, "popout-extrude-mesh.ts"), "utf8");
const shellSource = readFileSync(join(__dirname, "personalize-shell.tsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "personalize-preview.css"), "utf8");
const publicDir = join(__dirname, "../../public");

describe("Studio Personaj mode preview icons", () => {
  it("uses CSS figurine placeholder and a cutout drawing for pop-out", () => {
    expect(MODE_PREVIEW_ASSETS.figurine).toBe("/demo/glb/WHO.glb");
    expect(MODE_PREVIEW_ASSETS.popoutDrawing).toBe("/demo/studio/mode-popout-drawing.png");
    expect(existsSync(join(publicDir, "demo/studio/mode-popout-drawing.png"))).toBe(true);
    expect(shellSource).toMatch(/ModePreviewIcon/);
    expect(iconsSource).toMatch(/studio-ws__mode-icon-float/);
    expect(iconsSource).not.toMatch(/ModeGlbThumb/);
    expect(iconsSource).toMatch(/ModePopoutThumb/);
  });

  it("extrudes the pop-out drawing like Studio then floats the pop-out thumb", () => {
    expect(cutoutSource).toMatch(/createPreviewCutoutFromAlpha/);
    expect(extrudeSource).toMatch(/ExtrudeGeometry/);
    expect(extrudeSource).toMatch(/makePopoutComponentMesh/);
    expect(popoutThumbSource).toMatch(/createPreviewCutoutFromAlpha/);
    expect(popoutThumbSource).toMatch(/makePopoutComponentMesh/);
    expect(popoutThumbSource).toMatch(/previewVolumeDepth/);
    expect(popoutThumbSource).toMatch(/attachGlbPointerOrbit/);
    expect(popoutThumbSource).toMatch(/autoSpin/);
    expect(cssSource).toMatch(/\.studio-ws__mode-glb--figurine/);
    expect(cssSource).toMatch(/\.studio-ws__mode-glb--popout/);
    expect(cssSource).toMatch(/\.studio-ws__mode-paper/);
    expect(cssSource).toMatch(/\.studio-ws__mode-icon-float/);
    expect(cssSource).not.toMatch(/\.studio-ws__mode-blob\b/);
  });
});
