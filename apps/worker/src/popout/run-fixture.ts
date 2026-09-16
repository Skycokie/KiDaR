/**
 * Optional local fixture runner for Node BG removal + GLB sizes.
 * Usage (Linux/Railway-like hosts recommended):
 *   pnpm --filter @kidar/worker exec tsx src/popout/run-fixture.ts
 *
 * On this Windows agent, @imgly/background-removal-node + onnxruntime-node
 * currently aborts with GLib-GObject-CRITICAL; synthetic RGBA tests cover GLB.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCutoutFromBytes } from "./cutout-node";
import { buildPopoutGlb, isGlbBuffer } from "./build-glb";
import { optimizeGlb } from "./optimize";

const fixturePath = resolve(process.cwd(), "../../e2e/fixtures/test-photo.jpg");
const source = new Uint8Array(await readFile(fixturePath));
const cut = await createCutoutFromBytes(source);
const raw = await buildPopoutGlb({
  polygons: cut.polygons,
  width: cut.width,
  height: cut.height,
  rgba: cut.rgba
});
const { bytes, report } = await optimizeGlb(raw);
console.log(
  JSON.stringify(
    {
      fixture: "e2e/fixtures/test-photo.jpg",
      glbOk: isGlbBuffer(bytes),
      coverage: cut.stats.coverage,
      ...report,
      under1_5MB: report.optimizedBytes < 1.5 * 1024 * 1024
    },
    null,
    2
  )
);
