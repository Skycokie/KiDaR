#!/usr/bin/env node
/**
 * Idempotent Appwrite environment setup for kidAR Studio (M2/M3 creator flow).
 *
 * Usage:
 *   node scripts/setup-appwrite.mjs           # create/verify resources
 *   node scripts/setup-appwrite.mjs --verify  # read-only validation
 *   node scripts/setup-appwrite.mjs --dry-run # print planned actions only
 *
 * Required env (never printed):
 *   NEXT_PUBLIC_APPWRITE_ENDPOINT (or APPWRITE_ENDPOINT)
 *   NEXT_PUBLIC_APPWRITE_PROJECT_ID (or APPWRITE_PROJECT_ID)
 *   APPWRITE_API_KEY
 *
 * Optional resource IDs (defaults match apps/web/lib/appwrite/config.ts):
 *   APPWRITE_DATABASE_ID, APPWRITE_PROFILES_COLLECTION,
 *   APPWRITE_PROJECTS_COLLECTION, APPWRITE_JOBS_COLLECTION,
 *   APPWRITE_SOURCE_BUCKET, APPWRITE_ASSETS_BUCKET
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const {
  Client,
  Databases,
  Storage,
  Permission,
  Role,
  DatabasesIndexType,
  AppwriteException
} = require("node-appwrite");

const VERIFY = process.argv.includes("--verify");
const DRY_RUN = process.argv.includes("--dry-run");
const MUTE = VERIFY || DRY_RUN;

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, "apps/web/.env.local"));

const endpoint = requiredEnv(
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  process.env.APPWRITE_ENDPOINT
);
const projectId = requiredEnv(
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  process.env.APPWRITE_PROJECT_ID
);
const apiKey = requiredEnv("APPWRITE_API_KEY");

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "kidar";
const PROFILES = process.env.APPWRITE_PROFILES_COLLECTION || "profiles";
const PROJECTS = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";
const JOBS = process.env.APPWRITE_JOBS_COLLECTION || "jobs";
const SOURCE_BUCKET = process.env.APPWRITE_SOURCE_BUCKET || "source-drawings";
const ASSETS_BUCKET = process.env.APPWRITE_ASSETS_BUCKET || SOURCE_BUCKET;

/**
 * Collection-level permission: authenticated users may create documents.
 * Document-level permissions (set by the app on each document) restrict
 * read/update/delete to the owning user. documentSecurity must be true.
 */
const COLLECTION_CREATE_USERS = [Permission.create(Role.users())];

/**
 * Bucket-level permission: authenticated users may create files.
 * File-level permissions (set by the app) restrict access to the owner.
 * fileSecurity must be true. Free plan: one bucket shared by source + assets.
 */
const BUCKET_CREATE_USERS = [Permission.create(Role.users())];
const BUCKET_MAX_BYTES = 25 * 1024 * 1024;
const BUCKET_EXTENSIONS = ["png", "jpg", "jpeg", "glb", "svg", "mp3"];

const SCHEMA = [
  {
    id: PROFILES,
    name: "profiles",
    attributes: [
      { key: "plan", type: "string", size: 16, required: true },
      { key: "stripe_customer_id", type: "string", size: 128, required: false }
    ],
    indexes: []
  },
  {
    id: PROJECTS,
    name: "projects",
    attributes: [
      { key: "owner", type: "string", size: 36, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "slug", type: "string", size: 80, required: true },
      { key: "mode", type: "string", size: 16, required: true },
      { key: "source_image_path", type: "string", size: 64, required: false },
      { key: "mind_path", type: "string", size: 64, required: false },
      { key: "glb_path", type: "string", size: 64, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "settings", type: "string", size: 10000, required: true }
    ],
    indexes: [
      { key: "slug_unique", type: DatabasesIndexType.Unique, attributes: ["slug"] },
      { key: "owner_idx", type: DatabasesIndexType.Key, attributes: ["owner"] }
    ]
  },
  {
    id: JOBS,
    name: "jobs",
    attributes: [
      { key: "project_id", type: "string", size: 36, required: true },
      { key: "step", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "payload", type: "string", size: 5000, required: false },
      { key: "log", type: "string", size: 10000, required: false },
      // M4.1 pipeline state — optional so existing documents remain valid.
      // Free-plan attribute budget on this collection is exhausted after these
      // five additions; input_hash / last_error / artifact_hash / result live in
      // payload JSON (see apps/web/lib/appwrite/jobs.ts).
      { key: "attempt", type: "integer", required: false, min: 0, max: 100, default: 0 },
      { key: "max_attempts", type: "integer", required: false, min: 1, max: 100, default: 3 },
      { key: "next_run_at", type: "string", size: 40, required: false },
      { key: "locked_at", type: "string", size: 40, required: false },
      { key: "lock_token", type: "string", size: 64, required: false }
    ],
    indexes: [
      { key: "project_id_idx", type: DatabasesIndexType.Key, attributes: ["project_id"] },
      { key: "status_next_run_idx", type: DatabasesIndexType.Key, attributes: ["status", "next_run_at"] },
      { key: "status_locked_at_idx", type: DatabasesIndexType.Key, attributes: ["status", "locked_at"] }
    ]
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function requiredEnv(primary, fallback) {
  const value = process.env[primary] || fallback;
  if (!value) {
    const names = fallback === undefined ? primary : `${primary} (or APPWRITE_* alias)`;
    console.error(`Missing required environment variable: ${names}`);
    process.exit(1);
  }
  return value;
}

function isConflict(error) {
  if (!(error instanceof AppwriteException) && !(error && typeof error === "object")) {
    return false;
  }
  const code = error.code;
  const type = String(error.type || "");
  const message = String(error.message || "");
  return (
    code === 409 ||
    type.includes("already_exists") ||
    /already exists/i.test(message)
  );
}

function isNotFound(error) {
  return error?.code === 404;
}

function log(status, message) {
  console.log(`[${status}] ${message}`);
}

function permsEqual(actual, expected) {
  const a = [...(actual || [])].sort();
  const e = [...expected].sort();
  return a.length === e.length && a.every((value, index) => value === e[index]);
}

async function ensureDatabase(databases) {
  try {
    await databases.get({ databaseId: DATABASE_ID });
    log("ok", `database exists: ${DATABASE_ID}`);
    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  if (MUTE) {
    log(VERIFY ? "missing" : "would-create", `database ${DATABASE_ID}`);
    if (VERIFY) throw new Error(`Database missing: ${DATABASE_ID}`);
    return;
  }
  await databases.create({ databaseId: DATABASE_ID, name: DATABASE_ID });
  log("created", `database ${DATABASE_ID}`);
}

async function ensureCollection(databases, spec) {
  let collection;
  try {
    collection = await databases.getCollection({
      databaseId: DATABASE_ID,
      collectionId: spec.id
    });
    log("ok", `collection exists: ${spec.id}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    if (MUTE) {
      log(VERIFY ? "missing" : "would-create", `collection ${spec.id}`);
      if (VERIFY) throw new Error(`Collection missing: ${spec.id}`);
      return null;
    }
    collection = await databases.createCollection({
      databaseId: DATABASE_ID,
      collectionId: spec.id,
      name: spec.name,
      permissions: COLLECTION_CREATE_USERS,
      documentSecurity: true,
      enabled: true
    });
    log("created", `collection ${spec.id} (documentSecurity=true, create(users))`);
  }

  if (!collection) return null;

  const needsPermUpdate =
    collection.documentSecurity !== true ||
    !permsEqual(collection.$permissions, COLLECTION_CREATE_USERS);

  if (needsPermUpdate) {
    if (MUTE) {
      log(
        VERIFY ? "mismatch" : "would-update",
        `collection ${spec.id} permissions/documentSecurity`
      );
      if (VERIFY) {
        throw new Error(
          `Collection ${spec.id} must use documentSecurity=true and create("users")`
        );
      }
    } else {
      await databases.updateCollection({
        databaseId: DATABASE_ID,
        collectionId: spec.id,
        name: spec.name,
        permissions: COLLECTION_CREATE_USERS,
        documentSecurity: true,
        enabled: true
      });
      log("updated", `collection ${spec.id} permissions/documentSecurity`);
    }
  }

  return collection;
}

async function waitForAttribute(databases, collectionId, key) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const attr = await databases.getAttribute({
      databaseId: DATABASE_ID,
      collectionId,
      key
    });
    if (attr.status === "available") return attr;
    if (attr.status === "failed") {
      throw new Error(`Attribute ${collectionId}.${key} failed: ${attr.error || "unknown"}`);
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for attribute ${collectionId}.${key}`);
}

async function ensureAttributes(databases, spec) {
  let listed;
  try {
    listed = await databases.listAttributes({
      databaseId: DATABASE_ID,
      collectionId: spec.id
    });
  } catch (error) {
    if (MUTE && isNotFound(error)) return;
    throw error;
  }
  const existing = new Map(
    (listed.attributes || []).map((attr) => [attr.key, attr])
  );

  for (const attr of spec.attributes) {
    const attrType = attr.type || "string";
    const current = existing.get(attr.key);
    if (current) {
      if (
        attrType === "string" &&
        current.size != null &&
        attr.size != null &&
        Number(current.size) !== attr.size
      ) {
        log(
          "warn",
          `attribute ${spec.id}.${attr.key} exists with size ${current.size} (expected ${attr.size}); leaving unchanged`
        );
      } else if (Boolean(current.required) !== attr.required) {
        log(
          "warn",
          `attribute ${spec.id}.${attr.key} required=${current.required} (expected ${attr.required}); leaving unchanged`
        );
      } else {
        log("ok", `attribute exists: ${spec.id}.${attr.key}`);
      }
      continue;
    }

    if (MUTE) {
      log(VERIFY ? "missing" : "would-create", `attribute ${spec.id}.${attr.key}`);
      if (VERIFY) throw new Error(`Attribute missing: ${spec.id}.${attr.key}`);
      continue;
    }

    try {
      if (attrType === "integer") {
        await databases.createIntegerAttribute({
          databaseId: DATABASE_ID,
          collectionId: spec.id,
          key: attr.key,
          required: attr.required,
          min: attr.min,
          max: attr.max,
          xdefault: attr.default
        });
      } else {
        await databases.createStringAttribute({
          databaseId: DATABASE_ID,
          collectionId: spec.id,
          key: attr.key,
          size: attr.size,
          required: attr.required
        });
      }
      log("created", `attribute ${spec.id}.${attr.key} (${attrType})`);
      await waitForAttribute(databases, spec.id, attr.key);
    } catch (error) {
      if (isConflict(error)) {
        log("ok", `attribute exists: ${spec.id}.${attr.key}`);
        continue;
      }
      throw error;
    }
  }
}

async function waitForIndex(databases, collectionId, key) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const index = await databases.getIndex({
      databaseId: DATABASE_ID,
      collectionId,
      key
    });
    if (index.status === "available") return index;
    if (index.status === "failed") {
      throw new Error(`Index ${collectionId}.${key} failed: ${index.error || "unknown"}`);
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for index ${collectionId}.${key}`);
}

async function ensureIndexes(databases, spec) {
  let listed;
  try {
    listed = await databases.listIndexes({
      databaseId: DATABASE_ID,
      collectionId: spec.id
    });
  } catch (error) {
    if (MUTE && isNotFound(error)) return;
    throw error;
  }
  const existing = new Set((listed.indexes || []).map((index) => index.key));

  for (const index of spec.indexes) {
    if (existing.has(index.key)) {
      log("ok", `index exists: ${spec.id}.${index.key}`);
      continue;
    }
    if (MUTE) {
      log(VERIFY ? "missing" : "would-create", `index ${spec.id}.${index.key}`);
      if (VERIFY) throw new Error(`Index missing: ${spec.id}.${index.key}`);
      continue;
    }
    try {
      await databases.createIndex({
        databaseId: DATABASE_ID,
        collectionId: spec.id,
        key: index.key,
        type: index.type,
        attributes: index.attributes
      });
      log("created", `index ${spec.id}.${index.key}`);
      await waitForIndex(databases, spec.id, index.key);
    } catch (error) {
      if (isConflict(error)) {
        log("ok", `index exists: ${spec.id}.${index.key}`);
        continue;
      }
      throw error;
    }
  }
}

async function ensureBucket(storage, bucketId) {
  let bucket;
  try {
    bucket = await storage.getBucket({ bucketId });
    log("ok", `bucket exists: ${bucketId}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    if (MUTE) {
      log(VERIFY ? "missing" : "would-create", `bucket ${bucketId}`);
      if (VERIFY) throw new Error(`Bucket missing: ${bucketId}`);
      return;
    }
    bucket = await storage.createBucket({
      bucketId,
      name: "Project files",
      permissions: BUCKET_CREATE_USERS,
      fileSecurity: true,
      enabled: true,
      maximumFileSize: BUCKET_MAX_BYTES,
      allowedFileExtensions: BUCKET_EXTENSIONS
    });
    log("created", `bucket ${bucketId} (fileSecurity=true, create(users), 25MB)`);
    return;
  }

  const needsUpdate =
    bucket.fileSecurity !== true ||
    !permsEqual(bucket.$permissions, BUCKET_CREATE_USERS) ||
    Number(bucket.maximumFileSize) !== BUCKET_MAX_BYTES;

  if (!needsUpdate) return;

  if (MUTE) {
    log(VERIFY ? "mismatch" : "would-update", `bucket ${bucketId} settings`);
    if (VERIFY) {
      throw new Error(
        `Bucket ${bucketId} must use fileSecurity=true, create("users"), max 25MB`
      );
    }
    return;
  }

  await storage.updateBucket({
    bucketId,
    name: bucket.name || "Project files",
    permissions: BUCKET_CREATE_USERS,
    fileSecurity: true,
    enabled: true,
    maximumFileSize: BUCKET_MAX_BYTES,
    allowedFileExtensions: BUCKET_EXTENSIONS
  });
  log("updated", `bucket ${bucketId} settings`);
}

async function main() {
  const mode = VERIFY ? "verify" : DRY_RUN ? "dry-run" : "setup";
  console.log(`Appwrite ${mode}`);
  console.log(`endpoint: ${endpoint}`);
  console.log(`project: ${projectId}`);
  console.log(`database: ${DATABASE_ID}`);
  console.log(`collections: ${PROFILES}, ${PROJECTS}, ${JOBS}`);
  console.log(`source bucket: ${SOURCE_BUCKET}`);
  console.log(`assets bucket: ${ASSETS_BUCKET}`);
  if (SOURCE_BUCKET !== ASSETS_BUCKET) {
    log(
      "warn",
      "APPWRITE_SOURCE_BUCKET and APPWRITE_ASSETS_BUCKET differ; Free plan allows one bucket"
    );
  }
  console.log(
    "permissions: documentSecurity + collection create(users); fileSecurity + bucket create(users)"
  );
  console.log("note: scan_events is intentionally not created (M4)");

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);
  const storage = new Storage(client);

  await ensureDatabase(databases);

  for (const spec of SCHEMA) {
    const collection = await ensureCollection(databases, spec);
    if (!collection && MUTE) continue;
    await ensureAttributes(databases, spec);
    await ensureIndexes(databases, spec);
  }

  await ensureBucket(storage, SOURCE_BUCKET);
  if (ASSETS_BUCKET !== SOURCE_BUCKET) {
    await ensureBucket(storage, ASSETS_BUCKET);
  }

  console.log(`Appwrite ${mode} complete`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Appwrite setup failed: ${message}`);
  process.exit(1);
});
