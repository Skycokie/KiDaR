#!/usr/bin/env node
/**
 * Non-destructive Linux/Railway validation for M4.2 + M4.3 fixtures.
 *
 * Runs sequentially:
 *   pnpm -C apps/worker tsx src/popout/run-fixture.ts
 *   pnpm -C apps/worker tsx src/mindar/run-fixture.ts
 *
 * Prints a structured report with sizes, SHA-256 hashes, and pass/fail per stage.
 * Until this report is produced on a real Linux host, status remains:
 *   "code complete, Linux fixture validation pending"
 *
 * Usage (from repo root or apps/worker):
 *   pnpm -C apps/worker fixtures:linux
 *   node apps/worker/scripts/run-linux-fixtures.mjs
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(workerRoot, "../..");

function runTsx(relScript) {
  return new Promise((resolve) => {
    const child = spawn(
      "pnpm",
      ["exec", "tsx", relScript],
      {
        cwd: workerRoot,
        env: process.env,
        shell: true
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function extractJson(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sha256OfString(value) {
  return createHash("sha256").update(value).digest("hex");
}

const startedAt = new Date().toISOString();
const platform = `${process.platform}/${process.arch}`;
const isLinux = process.platform === "linux";

console.log("=== kidAR Linux fixtures (M4.2 popout + M4.3 mind) ===");
console.log(`platform: ${platform}`);
console.log(`cwd: ${workerRoot}`);
console.log(`repo: ${repoRoot}`);
console.log(`startedAt: ${startedAt}`);
if (!isLinux) {
  console.log(
    "NOTE: This host is not Linux. Results may fail due to ONNX/canvas native limits; Railway/Linux is the acceptance gate."
  );
}

const popout = await runTsx("src/popout/run-fixture.ts");
const popoutJson = extractJson(popout.stdout);
const popoutPass =
  popout.code === 0 &&
  popoutJson &&
  popoutJson.glbOk === true &&
  typeof popoutJson.optimizedBytes === "number" &&
  popoutJson.optimizedBytes > 0 &&
  popoutJson.under1_5MB === true &&
  popoutJson.texcoord0 === true &&
  popoutJson.uvFinite === true &&
  typeof popoutJson.uvCount === "number" &&
  popoutJson.uvCount > 0;

const mind = await runTsx("src/mindar/run-fixture.ts");
const mindJson = extractJson(mind.stdout);
const mindPass =
  mind.code === 0 &&
  mindJson &&
  mindJson.ok === true &&
  typeof mindJson.mindBytes === "number" &&
  mindJson.mindBytes > 0 &&
  typeof mindJson.sha256 === "string" &&
  /^[a-f0-9]{64}$/i.test(mindJson.sha256);

const report = {
  status:
    popoutPass && mindPass
      ? isLinux
        ? "linux_fixtures_passed"
        : "fixtures_passed_non_linux_host"
      : "failed_or_incomplete",
  verdict: {
    popout: popoutPass ? "pass" : "fail",
    mind: mindPass ? "pass" : "fail"
  },
  platform,
  isLinux,
  startedAt,
  finishedAt: new Date().toISOString(),
  popout: {
    exitCode: popout.code,
    rawBytes: popoutJson?.rawBytes ?? null,
    optimizedBytes: popoutJson?.optimizedBytes ?? null,
    coverage: popoutJson?.coverage ?? null,
    operations: popoutJson?.operations ?? null,
    reportSha256: popoutJson ? sha256OfString(JSON.stringify(popoutJson)) : null,
    detail: popoutJson
  },
  mind: {
    exitCode: mind.code,
    mindBytes: mindJson?.mindBytes ?? null,
    sha256: mindJson?.sha256 ?? null,
    detail: mindJson
  },
  note:
    popoutPass && mindPass && isLinux
      ? "Both fixture stages passed on Linux."
      : 'Until a Linux/Railway run produces pass/pass, treat M4.2+M4.3 as "code complete, Linux fixture validation pending" — not "pipeline production complete".'
};

console.log("\n=== structured report ===");
console.log(JSON.stringify(report, null, 2));

if (!popoutPass || !mindPass) {
  process.exitCode = 1;
}
