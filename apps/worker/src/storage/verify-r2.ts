/**
 * Non-destructive R2 probe.
 *
 * Default: validate R2_* config and print the proposed verify key (no writes).
 * `--write`: PUT + public GET + HEAD, then delete only that `__kidar_verify__/` object.
 *
 * Never lists the bucket. Never touches project artifact prefixes.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IMMUTABLE_CACHE_CONTROL,
  R2_VERIFY_KEY_PREFIX,
  publicArtifactUrl,
  resolvePublicStorageConfig
} from "@kidar/core";
import { createWorkerPublicStorage, deleteR2VerifyObject } from "./public";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(workerRoot, "../..");

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function flag(name: string): string {
  return process.env[name]?.trim() ? "SET" : "EMPTY";
}

loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
loadEnvFile(path.join(repoRoot, "apps/worker/.env.local"));

const WRITE = process.argv.includes("--write");
const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL"
] as const;

console.log("=== kidAR R2 verify (non-destructive) ===");
for (const name of REQUIRED) {
  console.log(`${name}: ${flag(name)}`);
}
console.log(`R2_ENDPOINT: ${flag("R2_ENDPOINT")}`);

try {
  const config = resolvePublicStorageConfig(process.env);
  if (config.provider !== "r2") {
    throw new Error("Resolved public storage is not R2.");
  }
  console.log("config: ok");
  console.log(`bucket: ${config.bucket}`);
  console.log(`publicBaseUrl: ${config.publicBaseUrl}`);
  console.log("endpointHost: configured (S3 API; value not printed)");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`config: fail — ${message}`);
  console.error(
    "Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL."
  );
  console.error("R2_ENDPOINT optional (defaults to https://<account-id>.r2.cloudflarestorage.com).");
  console.error("R2_PUBLIC_BASE_URL must be the HTTPS CDN/public host, not the S3 API endpoint.");
  process.exitCode = 1;
  process.exit();
}

const config = resolvePublicStorageConfig(process.env);
if (config.provider !== "r2") {
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const nonce = randomBytes(6).toString("hex");
const key = `${R2_VERIFY_KEY_PREFIX}${stamp}-${nonce}.txt`;
const bodyText = "kidar-r2-verify\n";
console.log(`proposedKey: ${key}`);
console.log(`proposedPublicUrl: ${publicArtifactUrl(config.publicBaseUrl, key)}`);

if (!WRITE) {
  console.log("mode: check-only (pass --write to PUT/GET/DELETE this verify object)");
  process.exit(0);
}

const storage = createWorkerPublicStorage(process.env);
const body = new Uint8Array(Buffer.from(bodyText, "utf8"));

try {
  const written = await storage.write({
    key,
    body,
    contentType: "text/plain; charset=utf-8",
    cacheControl: IMMUTABLE_CACHE_CONTROL
  });
  console.log(`put: ok key=${written.key}`);

  const meta = await storage.getMetadata(key);
  console.log(
    `head: ok contentType=${meta?.contentType ?? "unknown"} size=${meta?.size ?? "unknown"}`
  );

  const publicResponse = await fetch(written.publicUrl, { redirect: "follow" });
  const publicBody = await publicResponse.text();
  console.log(`publicGET: status=${publicResponse.status}`);
  if (publicResponse.status !== 200) {
    throw new Error(
      `Public GET failed (${publicResponse.status}). Confirm R2_PUBLIC_BASE_URL custom domain / r2.dev public access has propagated.`
    );
  }
  if (!publicBody.includes("kidar-r2-verify")) {
    throw new Error("Public GET body did not match the verify payload.");
  }
  const cacheHeader = publicResponse.headers.get("cache-control") || "";
  console.log(`publicCacheControl: ${cacheHeader || "(none)"}`);
} finally {
  await deleteR2VerifyObject({ config, key });
  console.log("delete: ok (verify object only)");
}

console.log("probe: passed");
