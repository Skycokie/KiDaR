/**
 * Internal: run one staging figure job (GLB + USDZ) for a single approved project.
 * Does not touch Publish, production R2, or Vercel. Requires staging env only.
 *
 * Usage:
 *   pnpm exec tsx scripts/internal-figure-staging.ts <projectId> [sourceImageUrl]
 *
 * Required env (staging):
 *   R2_STAGING_BUCKET=kidar-figures-staging (R2_BUCKET may alias the same)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   Do NOT set R2_PUBLIC_BASE_URL for staging.
 *   NEXT_PUBLIC_APPWRITE_PROJECT_ID (staging), KIDAR_PRODUCTION_APPWRITE_PROJECT_ID (guard)
 *   APPWRITE_API_KEY, NEXT_PUBLIC_APPWRITE_ENDPOINT, TRIPO_API_KEY
 * Optional:
 *   FIGURE_STAGING_JOB_ID — stable job id for idempotent retries
 */
import { Client, Databases, Storage } from "node-appwrite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FIGURE_STAGING_ENVIRONMENT,
  decideFigureGeneration,
  readFigureFeatureFlags,
  type FigureAssets,
  type FigureGenerationJob,
  type FigureLifecycle
} from "@kidar/core";
import { createStagingR2WriteStorage } from "../apps/worker/src/storage/staging-r2";
import { runFigureStagingBuild } from "../apps/worker/src/figurine/staging-stage";

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

loadEnv(resolve(rootGuess, ".env.staging.local"));
loadEnv(resolve(rootGuess, "apps/worker/.env.staging.local"));

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: tsx scripts/internal-figure-staging.ts <projectId> [sourceImageUrl]");
  process.exit(1);
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT;
const appwriteProject = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !appwriteProject || !apiKey) {
  throw new Error("Missing staging Appwrite env (endpoint, project id, API key)");
}

const databaseId = process.env.APPWRITE_DATABASE_ID || "kidar";
const projectsCollection = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";
const sourceBucket = process.env.APPWRITE_SOURCE_BUCKET || "source-drawings";

const client = new Client().setEndpoint(endpoint).setProject(appwriteProject).setKey(apiKey);
const databases = new Databases(client);
const files = new Storage(client);

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

async function loadSourceFromAppwrite(fileId: string): Promise<Uint8Array> {
  const ab = await files.getFileDownload(sourceBucket, fileId);
  return new Uint8Array(Buffer.from(ab as unknown as ArrayBuffer));
}

function mapStagingStatus(status: FigureAssets["status"] | undefined): FigureLifecycle | null {
  if (status === "pending") return "draft";
  if (status === "processing") return "processing";
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  return null;
}

async function loadSourceFromUrl(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Source download HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function main() {
  const doc = await databases.getDocument(databaseId, projectsCollection, projectId);
  const data = doc as Record<string, unknown>;
  const settings = parseSettings(data.settings);
  const sourceImagePath = (data.source_image_path as string | null) ?? null;
  const sourceArg = process.argv[3];
  const sourceImageUrl =
    sourceArg ||
    (sourceImagePath ? `appwrite://${sourceBucket}/${sourceImagePath}` : null);
  if (!sourceImageUrl) {
    throw new Error("Project has no source_image_path and no sourceImageUrl argument");
  }

  const prior = (settings.figureStagingTasks as Record<string, string> | undefined) ?? {};
  const proposedJobId =
    process.env.FIGURE_STAGING_JOB_ID ||
    (typeof prior.jobId === "string" && prior.jobId) ||
    randomUUID().replace(/-/g, "").slice(0, 24);
  const drawingVersion = (sourceImagePath || sourceImageUrl).trim();
  const storedAssets = settings.figureAssets as FigureAssets | undefined;
  const ownerId =
    typeof data.owner === "string" && data.owner.trim() ? data.owner.trim() : "internal-operator";
  const lifecycle = mapStagingStatus(storedAssets?.status);
  const decision = decideFigureGeneration({
    flags: readFigureFeatureFlags(process.env),
    projectId,
    drawingVersion,
    requesterId: ownerId,
    ownerId,
    proposedJobId,
    existing:
      lifecycle && typeof prior.jobId === "string" && prior.jobId
        ? {
            jobId: prior.jobId,
            status: lifecycle,
            drawingVersion: typeof prior.drawingVersion === "string" ? prior.drawingVersion : null
          }
        : null
  });
  if (decision.action === "reject") {
    throw new Error(`Figure generation blocked: ${decision.code}`);
  }
  if (decision.action === "reuse") {
    console.log(
      JSON.stringify({
        action: "figure_staging_idempotent_reuse",
        projectId,
        jobId: decision.jobId,
        environment: FIGURE_STAGING_ENVIRONMENT,
        publish: false
      })
    );
    return;
  }
  const jobId = decision.jobId;

  const taskIds: {
    jobId: string;
    drawingVersion: string;
    providerTaskId?: string;
    retopoTaskId?: string;
    convertTaskId?: string;
  } = {
    jobId,
    drawingVersion,
    providerTaskId: typeof prior.providerTaskId === "string" ? prior.providerTaskId : undefined,
    retopoTaskId: typeof prior.retopoTaskId === "string" ? prior.retopoTaskId : undefined,
    convertTaskId: typeof prior.convertTaskId === "string" ? prior.convertTaskId : undefined
  };

  const job: FigureGenerationJob = {
    jobId,
    environment: FIGURE_STAGING_ENVIRONMENT,
    projectId,
    sourceImageUrl,
    requestedFormats: ["glb", "usdz"],
    requestedBy: "internal"
  };

  console.log(
    JSON.stringify(
      {
        action: "figure_staging_start",
        projectId,
        jobId,
        environment: job.environment,
        hasPriorTasks: Boolean(taskIds.providerTaskId),
        publish: false
      },
      null,
      2
    )
  );

  async function writeProject(assets: FigureAssets | undefined, status: string) {
    await databases.updateDocument(databaseId, projectsCollection, projectId, {
      settings: JSON.stringify({
        ...settings,
        figureAssets: assets,
        figureStagingTasks: { ...taskIds }
      }),
      status
    });
  }

  const publicStorage = createStagingR2WriteStorage(process.env);
  const result = await runFigureStagingBuild(job, {
    storage: publicStorage,
    env: process.env,
    priorTaskIds: {
      providerTaskId: taskIds.providerTaskId,
      retopoTaskId: taskIds.retopoTaskId,
      convertTaskId: taskIds.convertTaskId
    },
    loadSource: async (url) => {
      if (url.startsWith("appwrite://")) {
        const rest = url.slice("appwrite://".length);
        const slash = rest.indexOf("/");
        const fileId = slash >= 0 ? rest.slice(slash + 1) : rest;
        return loadSourceFromAppwrite(fileId);
      }
      return loadSourceFromUrl(url);
    },
    onProgress: async (patch) => {
      if (patch.providerTaskId) taskIds.providerTaskId = patch.providerTaskId;
      if (patch.retopoTaskId) taskIds.retopoTaskId = patch.retopoTaskId;
      if (patch.convertTaskId) taskIds.convertTaskId = patch.convertTaskId;
      const shouldPersist =
        patch.phase === "provider_running" ||
        patch.phase === "retopologizing" ||
        patch.phase === "converting" ||
        patch.phase === "ready" ||
        patch.phase === "failed";
      if (shouldPersist) {
        const status =
          patch.phase === "ready" ? "ready" : patch.phase === "failed" ? "error" : "processing";
        await writeProject(patch.assets, status);
      }
    }
  });

  await writeProject(
    result.assets,
    result.assets.status === "ready" ? "ready" : "error"
  );

  console.log(
    JSON.stringify(
      {
        action: "figure_staging_done",
        kind: result.kind,
        status: result.assets.status,
        glbKey: result.glbKey,
        usdzKey: result.usdzKey,
        errorCode: result.assets.errorCode ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ action: "figure_staging_error", message: message.slice(0, 300) }));
  process.exit(1);
});
