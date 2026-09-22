/**
 * Internal: enqueue one figurine_build via Appwrite admin (no publish, no Tripo here).
 * Mirrors apps/web figurine POST + enqueueJob payload shape so Hetzner worker can claim it.
 */
import { Client, Databases, ID, Permission, Query, Role } from "node-appwrite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FIGURINE_PROVIDER,
  JOB_MAX_ATTEMPTS
} from "@kidar/core";
import { computeInputHash, sha256Hex } from "@kidar/core/hash";

function loadEnv(path: string) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      if (process.env[m[1]] !== undefined) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}

const rootGuess = (() => {
  const cwd = process.cwd();
  if (/[\\/]apps[\\/]worker$/i.test(cwd)) return resolve(cwd, "../..");
  if (/[\\/]apps[\\/]web$/i.test(cwd)) return resolve(cwd, "../..");
  return cwd;
})();
loadEnv(resolve(rootGuess, ".env.local"));
loadEnv(resolve(rootGuess, "apps/web/.env.local"));

const projectId = process.argv[2] || "6aafaf8500011d0ac857";
const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const appwriteProject = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !appwriteProject || !apiKey) {
  throw new Error(`Missing Appwrite env from ${rootGuess}`);
}

const databaseId = process.env.APPWRITE_DATABASE_ID || "kidar";
const projectsCollection = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";
const jobsCollection = process.env.APPWRITE_JOBS_COLLECTION || "jobs";
const sourceBucket = process.env.APPWRITE_SOURCE_BUCKET || "source-drawings";

const client = new Client().setEndpoint(endpoint).setProject(appwriteProject).setKey(apiKey);
const databases = new Databases(client);

function parseSettings(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

async function main() {
  const doc = await databases.getDocument(databaseId, projectsCollection, projectId);
  const data = doc as Record<string, unknown>;
  const ownerId = String(data.owner ?? "");
  const sourceImagePath = (data.source_image_path as string | null) ?? null;
  if (!ownerId) throw new Error("Project has no owner");
  if (!sourceImagePath) throw new Error("Project has no source_image_path");

  const settings = parseSettings(data.settings);
  const offset = (settings.offset as { x?: number; y?: number; z?: number } | undefined) ?? {};
  const hashSettings = {
    title: String(settings.title ?? ""),
    theme: String(settings.theme ?? "#6d5dfc"),
    scale: Number(settings.scale ?? 1),
    offset: {
      x: Number(offset.x ?? 0),
      y: Number(offset.y ?? 0),
      z: Number(offset.z ?? 0)
    },
    ctaText: settings.ctaText as string | undefined,
    ctaUrl: settings.ctaUrl as string | undefined,
    galleryModelUrl: settings.galleryModelUrl as string | undefined,
    figurineModelUrl: settings.figurineModelUrl as string | undefined,
    uploadModelPath: settings.uploadModelPath as string | undefined,
    logoPath: settings.logoPath as string | undefined,
    soundPath: settings.soundPath as string | undefined
  };

  const inputHash = computeInputHash({
    projectId,
    mode: "figurine_3d",
    source: {
      fileId: sourceImagePath,
      checksum: sha256Hex(`appwrite:${sourceBucket}:${sourceImagePath}`)
    },
    settings: hashSettings
  });

  console.log(
    JSON.stringify(
      {
        projectId,
        ownerId: `${ownerId.slice(0, 8)}…`,
        modeBefore: data.mode ?? null,
        hasSource: true,
        sourceFileIdPrefix: String(sourceImagePath).slice(0, 12),
        inputHash,
        publish: false
      },
      null,
      2
    )
  );

  const existing = await databases.listDocuments(databaseId, jobsCollection, [
    Query.equal("project_id", projectId),
    Query.equal("step", "figurine_build"),
    Query.orderDesc("$createdAt"),
    Query.limit(50)
  ]);

  for (const jobDoc of existing.documents) {
    const bag = parsePayload((jobDoc as { payload?: unknown }).payload);
    if (bag.input_hash !== inputHash) continue;
    const status = String((jobDoc as { status?: string }).status);
    if (status === "queued" || status === "running" || status === "done") {
      console.log(
        JSON.stringify({
          action: "reuse_existing",
          jobId: jobDoc.$id,
          status,
          kind: status === "done" ? "idempotent_done" : "existing"
        })
      );
      return;
    }
  }

  const subjectId = "primary";
  const subjects = Array.isArray(settings.figurineSubjects)
    ? (settings.figurineSubjects as Record<string, unknown>[]).filter((s) => s.id !== subjectId)
    : [];
  subjects.push({
    id: subjectId,
    sourceFileId: sourceImagePath,
    label: "Personaj",
    status: "queued",
    progress: 0,
    provider: FIGURINE_PROVIDER
  });

  await databases.updateDocument(databaseId, projectsCollection, projectId, {
    mode: "figurine_3d",
    status: "processing",
    settings: JSON.stringify({
      ...settings,
      figurineSubjects: subjects
    })
  });

  const now = new Date().toISOString();
  const created = await databases.createDocument(
    databaseId,
    jobsCollection,
    ID.unique(),
    {
      project_id: projectId,
      step: "figurine_build",
      status: "queued",
      attempt: 0,
      max_attempts: JOB_MAX_ATTEMPTS,
      next_run_at: now,
      locked_at: null,
      lock_token: null,
      payload: JSON.stringify({
        source: "studio_figurine",
        subjectId,
        input_hash: inputHash,
        artifact_hash: null,
        last_error: null,
        result: null
      })
    },
    [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId))
    ]
  );

  console.log(
    JSON.stringify({
      action: "created",
      jobId: created.$id,
      status: "queued",
      inputHash,
      mode: "figurine_3d",
      publish: false,
      note: "Worker on Hetzner will claim; Tripo runs only there"
    })
  );

}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
