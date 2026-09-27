#!/usr/bin/env node
/**
 * One-time migration: make existing profiles, projects, jobs and files
 * owner-read-only, matching the server-only write model.
 *
 * Usage:
 *   node scripts/migrate-appwrite-permissions.mjs                       # dry run (read-only)
 *   node scripts/migrate-appwrite-permissions.mjs --apply --project=<id> # write
 *
 * --apply requires --project to equal the configured Appwrite project id,
 * so a copied command cannot silently run against another environment.
 * Env is read the same way as setup-appwrite.mjs (never printed).
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const { Client, Databases, Storage, Permission, Role, Query } = require("node-appwrite");

const APPLY = process.argv.includes("--apply");
const projectArg = process.argv.find((arg) => arg.startsWith("--project="))?.slice("--project=".length);

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, "apps/web/.env.local"));

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey) {
  console.error("Missing NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY");
  process.exit(1);
}
if (APPLY && projectArg !== projectId) {
  console.error(`--apply requires --project=${projectId} (got ${projectArg ?? "nothing"})`);
  process.exit(1);
}

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "kidar";
const PROFILES = process.env.APPWRITE_PROFILES_COLLECTION || "profiles";
const PROJECTS = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";
const JOBS = process.env.APPWRITE_JOBS_COLLECTION || "jobs";
const SOURCE_BUCKET = process.env.APPWRITE_SOURCE_BUCKET || "source-drawings";
const ASSETS_BUCKET = process.env.APPWRITE_ASSETS_BUCKET || SOURCE_BUCKET;

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

const readOnly = (userId) => [Permission.read(Role.user(userId))];

function ownerFromPermissions(permissions) {
  for (const perm of permissions || []) {
    const match = /^read\("user:([^"/]+)"\)$/.exec(perm);
    if (match) return match[1];
  }
  return null;
}

function sameSet(a, b) {
  const x = [...(a || [])].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((value, index) => value === y[index]);
}

async function* pages(list) {
  let cursor = null;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const batch = await list(queries);
    const items = batch.documents ?? batch.files ?? [];
    for (const item of items) yield item;
    if (items.length < 100) return;
    cursor = items[items.length - 1].$id;
  }
}

const stats = { ok: 0, changed: 0, skipped: 0, failed: 0 };

async function fixDocuments(collectionId, ownerOf) {
  for await (const doc of pages((queries) => databases.listDocuments(DATABASE_ID, collectionId, queries))) {
    const owner = await ownerOf(doc);
    if (!owner) {
      stats.skipped += 1;
      console.log(`[skip] ${collectionId}/${doc.$id}: owner unknown`);
      continue;
    }
    const wanted = readOnly(owner);
    if (sameSet(doc.$permissions, wanted)) {
      stats.ok += 1;
      continue;
    }
    if (APPLY) {
      try {
        await databases.updateDocument(DATABASE_ID, collectionId, doc.$id, {}, wanted);
      } catch (error) {
        // Appwrite re-validates the whole document, so legacy rows missing a
        // now-required attribute cannot be updated without inventing data.
        stats.failed += 1;
        console.log(`[fail] ${collectionId}/${doc.$id}: ${String(error?.message ?? error).slice(0, 120)}`);
        continue;
      }
    }
    stats.changed += 1;
    console.log(`[${APPLY ? "fix" : "would-fix"}] ${collectionId}/${doc.$id}`);
  }
}

async function fixFiles(bucketId) {
  for await (const file of pages((queries) => storage.listFiles(bucketId, queries))) {
    const owner = ownerFromPermissions(file.$permissions);
    if (!owner) {
      stats.skipped += 1;
      console.log(`[skip] ${bucketId}/${file.$id}: owner unknown`);
      continue;
    }
    const wanted = readOnly(owner);
    if (sameSet(file.$permissions, wanted)) {
      stats.ok += 1;
      continue;
    }
    if (APPLY) {
      try {
        await storage.updateFile(bucketId, file.$id, undefined, wanted);
      } catch (error) {
        stats.failed += 1;
        console.log(`[fail] ${bucketId}/${file.$id}: ${String(error?.message ?? error).slice(0, 120)}`);
        continue;
      }
    }
    stats.changed += 1;
    console.log(`[${APPLY ? "fix" : "would-fix"}] ${bucketId}/${file.$id}`);
  }
}

const projectOwners = new Map();
async function projectOwner(projectDocId) {
  if (!projectDocId) return null;
  if (projectOwners.has(projectDocId)) return projectOwners.get(projectDocId);
  let owner = null;
  try {
    owner = (await databases.getDocument(DATABASE_ID, PROJECTS, projectDocId)).owner ?? null;
  } catch {
    owner = null;
  }
  projectOwners.set(projectDocId, owner);
  return owner;
}

console.log(`Appwrite permission migration (${APPLY ? "APPLY" : "dry run"})`);
console.log(`project: ${projectId}`);

await fixDocuments(PROFILES, (doc) => doc.$id);
await fixDocuments(PROJECTS, (doc) => doc.owner || ownerFromPermissions(doc.$permissions));
await fixDocuments(JOBS, async (doc) => (await projectOwner(doc.project_id)) || ownerFromPermissions(doc.$permissions));
for (const bucketId of new Set([SOURCE_BUCKET, ASSETS_BUCKET])) await fixFiles(bucketId);

console.log(
  `done: ${stats.ok} already ok, ${stats.changed} ${APPLY ? "fixed" : "to fix"}, ${stats.skipped} skipped, ${stats.failed} failed`
);
if (stats.failed > 0) process.exitCode = 1;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") process.env[key] = value;
  }
}
