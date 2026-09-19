/**
 * Optional local fixture runner for Node BG removal + GLB sizes.
 * Usage (Linux/Railway-like hosts recommended):
 *   pnpm -C apps/worker tsx src/popout/run-fixture.ts
 *   pnpm -C apps/worker fixtures:linux   # popout + mind combined report
 *
 * On this Windows agent, @imgly/background-removal-node + onnxruntime-node
 * currently aborts with GLib-GObject-CRITICAL; synthetic RGBA tests cover GLB.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { createCutoutFromBytes } from "./cutout-node";
import { buildPopoutGlb, isGlbBuffer } from "./build-glb";
import { optimizeGlb } from "./optimize";

async function texcoordSummary(bytes: Uint8Array) {
  const document = await new NodeIO().readBinary(bytes);
  const primitive = document.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const uvs = primitive?.getAttribute("TEXCOORD_0");
  const positions = primitive?.getAttribute("POSITION");
  const uvArray = uvs?.getArray();
  let minU = 1;
  let maxU = 0;
  let minV = 1;
  let maxV = 0;
  let finite = true;
  for (let i = 0; uvArray && i + 1 < uvArray.length; i += 2) {
    const u = uvArray[i];
    const v = uvArray[i + 1];
    if (!Number.isFinite(u) || !Number.isFinite(v)) finite = false;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return {
    texcoord0: Boolean(uvs),
    uvCount: uvs?.getCount() ?? 0,
    positionCount: positions?.getCount() ?? 0,
    uvFinite: finite,
    uvMinU: minU,
    uvMaxU: maxU,
    uvMinV: minV,
    uvMaxV: maxV
  };
}

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
const uvs = await texcoordSummary(bytes);
console.log(
  JSON.stringify(
    {
      fixture: "e2e/fixtures/test-photo.jpg",
      glbOk: isGlbBuffer(bytes),
      coverage: cut.stats.coverage,
      ...report,
      under1_5MB: report.optimizedBytes < 1.5 * 1024 * 1024,
      ...uvs
    },
    null,
    2
  )
);
