/**
 * Allowlisted public write of the two AR runtime scripts.
 *
 * Refuses every other object key. Does not enqueue jobs, write pages/,
 * models/, targets/, or experiences/.
 *
 * Pass `--write` to PUT. Without it, fetches + hash-checks only.
 */
import {
  IMMUTABLE_CACHE_CONTROL,
  PUBLIC_ARTIFACT_CONTENT_TYPES,
  PublicStorageConfigError,
  type PublicArtifactStorage
} from "@kidar/core";
import {
  AFRAME_RUNTIME_OBJECT_KEY,
  AFRAME_UPSTREAM_SCRIPT_URL,
  MINDAR_RUNTIME_OBJECT_KEY,
  MINDAR_UPSTREAM_SCRIPT_URL
} from "../pagerender/runtime-keys";
import { sha256Hex } from "@kidar/core/hash";
import { createWorkerPublicStorage } from "./public";

export const APPROVED_AR_RUNTIME_ASSETS = [
  {
    key: AFRAME_RUNTIME_OBJECT_KEY,
    sha256: "14505830827befef85276e7f7548d2a5f3e04b91b24358e2e7535e42dafc80be",
    sourceUrl: AFRAME_UPSTREAM_SCRIPT_URL
  },
  {
    key: MINDAR_RUNTIME_OBJECT_KEY,
    sha256: "42764d6f1b39387f5786b9c4cfbe50883e13ca3f47b42bf1e54e84510b374013",
    sourceUrl: MINDAR_UPSTREAM_SCRIPT_URL
  }
] as const;

const ALLOWED_KEYS = new Set<string>(APPROVED_AR_RUNTIME_ASSETS.map((asset) => asset.key));

export function assertApprovedRuntimeAsset(key: string, sha256: string, body: Uint8Array): void {
  if (!ALLOWED_KEYS.has(key) || !key.startsWith("runtime/") || key.includes("..")) {
    throw new PublicStorageConfigError(`Refusing runtime key outside allowlist: ${key}`);
  }
  const approved = APPROVED_AR_RUNTIME_ASSETS.find((asset) => asset.key === key);
  if (!approved || approved.sha256 !== sha256) {
    throw new PublicStorageConfigError(`Refusing runtime asset with unapproved checksum for ${key}`);
  }
  const actual = sha256Hex(body);
  if (actual !== approved.sha256) {
    throw new PublicStorageConfigError(
      `Runtime body SHA-256 mismatch for ${key}: got ${actual}`
    );
  }
}

async function fetchApprovedBody(sourceUrl: string): Promise<Uint8Array> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Upstream fetch HTTP ${response.status} for ${sourceUrl}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function publishApprovedArRuntimeScripts(input: {
  write: boolean;
  storage?: PublicArtifactStorage;
  fetchBody?: (sourceUrl: string) => Promise<Uint8Array>;
}): Promise<Array<{ key: string; sha256: string; publicUrl: string; kind: "written" | "idempotent" | "checked" }>> {
  const storage = input.storage ?? createWorkerPublicStorage();
  const fetchBody = input.fetchBody ?? fetchApprovedBody;
  const results: Array<{
    key: string;
    sha256: string;
    publicUrl: string;
    kind: "written" | "idempotent" | "checked";
  }> = [];

  for (const asset of APPROVED_AR_RUNTIME_ASSETS) {
    const body = await fetchBody(asset.sourceUrl);
    assertApprovedRuntimeAsset(asset.key, asset.sha256, body);
    const publicUrl = storage.getPublicUrl(asset.key);
    if (!input.write) {
      results.push({ key: asset.key, sha256: asset.sha256, publicUrl, kind: "checked" });
      continue;
    }
    const existing = await storage.getMetadata(asset.key);
    if (existing?.checksum === asset.sha256) {
      results.push({ key: asset.key, sha256: asset.sha256, publicUrl, kind: "idempotent" });
      continue;
    }
    if (existing?.checksum && existing.checksum !== asset.sha256) {
      throw new PublicStorageConfigError(
        `Refusing to overwrite ${asset.key}; existing checksum differs`
      );
    }
    await storage.write({
      key: asset.key,
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.js,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      checksum: asset.sha256
    });
    const verified = await storage.getMetadata(asset.key);
    if (!verified || verified.checksum !== asset.sha256) {
      throw new PublicStorageConfigError(`R2 verify failed for ${asset.key}`);
    }
    results.push({ key: asset.key, sha256: asset.sha256, publicUrl, kind: "written" });
  }
  return results;
}

const cliEntry = process.argv[1]?.replaceAll("\\", "/") ?? "";
const isCli =
  cliEntry.endsWith("/publish-runtime.ts") || cliEntry.endsWith("/publish-runtime.js");
if (isCli) {
  const write = process.argv.includes("--write");
  const results = await publishApprovedArRuntimeScripts({ write });
  for (const result of results) {
    console.log(`${result.kind} ${result.key} sha256=${result.sha256}`);
  }
  if (!write) {
    console.log("mode: check-only (pass --write to PUT the two approved runtime keys)");
  }
}
