/**
 * Optional local fixture runner for MindAR OfflineCompiler.
 * Usage (Linux/Railway-like hosts recommended):
 *   pnpm -C apps/worker tsx src/mindar/run-fixture.ts
 *
 * Writes only under a temp directory (cleaned on exit). Prints size + sha256.
 * On Windows, node-canvas / TFJS may be limited — treat Linux as the gate.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { compileTargetsMind } from "./compile";

const fixturePath = resolve(process.cwd(), "../../e2e/fixtures/test-photo.jpg");
const source = new Uint8Array(await readFile(fixturePath));
const tempRoot = await mkdtemp(resolve(tmpdir(), "kidar-mind-fixture-"));

try {
  const mind = await compileTargetsMind(source);
  const outPath = resolve(tempRoot, "targets.mind");
  await writeFile(outPath, mind);
  const sha256 = createHash("sha256").update(mind).digest("hex");
  console.log(
    JSON.stringify(
      {
        fixture: "e2e/fixtures/test-photo.jpg",
        outPath,
        mindBytes: mind.byteLength,
        sha256,
        ok: mind.byteLength > 0
      },
      null,
      2
    )
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
