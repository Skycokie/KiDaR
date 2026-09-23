/**
 * Controlled retopo retry: reopen figurine job with existing providerTaskId only.
 * Never clears providerTaskId. Never invents a new Image-to-3D submit.
 * Does not publish.
 */
import { Client, Databases } from "node-appwrite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
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

const root = /[\\/]apps[\\/]worker$/i.test(process.cwd())
  ? resolve(process.cwd(), "../..")
  : process.cwd();
loadEnv(resolve(root, ".env.local"));
loadEnv(resolve(root, "apps/web/.env.local"));

const EXPECTED_PROVIDER = "119bb6e9-30be-4a5c-85ed-53466344ffc9";

async function main() {
  const jobId = process.argv[2] || "6ab22dcb0024eda8ba51";
  const projectId = process.argv[3] || "6aafaf8500011d0ac857";
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  const db = new Databases(c);
  const databaseId = process.env.APPWRITE_DATABASE_ID || "kidar";
  const jobsCollection = process.env.APPWRITE_JOBS_COLLECTION || "jobs";
  const projectsCollection = process.env.APPWRITE_PROJECTS_COLLECTION || "projects";

  const job = await db.getDocument(databaseId, jobsCollection, jobId);
  const bag =
    typeof (job as { payload?: unknown }).payload === "string"
      ? (JSON.parse((job as { payload: string }).payload) as Record<string, unknown>)
      : ((job as { payload?: Record<string, unknown> }).payload ?? {});
  const result = (bag.result as Record<string, unknown> | null) ?? {};
  const providerTaskId =
    typeof result.providerTaskId === "string" ? result.providerTaskId : "";
  const retopoTaskId =
    typeof result.retopoTaskId === "string" ? result.retopoTaskId : "";

  if (!providerTaskId) {
    throw new Error("ABORT: providerTaskId missing — would risk new Image-to-3D");
  }
  if (providerTaskId !== EXPECTED_PROVIDER) {
    throw new Error(
      `ABORT: providerTaskId mismatch (got ${providerTaskId}, expected ${EXPECTED_PROVIDER})`
    );
  }
  if (retopoTaskId) {
    console.log(
      JSON.stringify({
        note: "retopoTaskId already present — reopen will resume that retopo only",
        retopoTaskId
      })
    );
  }

  const now = new Date().toISOString();
  const nextResult: Record<string, unknown> = {
    provider: "tripo",
    subjectId: "primary",
    providerTaskId,
    phase: "provider_queued",
    progress: 10
  };
  // Intentionally omit retopoTaskId when absent so worker may submit ONE retopo after success.
  if (retopoTaskId) nextResult.retopoTaskId = retopoTaskId;

  await db.updateDocument(databaseId, jobsCollection, jobId, {
    status: "queued",
    attempt: 0,
    next_run_at: now,
    locked_at: null,
    lock_token: null,
    payload: JSON.stringify({
      ...bag,
      last_error: null,
      artifact_hash: null,
      result: nextResult
    })
  });

  const project = await db.getDocument(databaseId, projectsCollection, projectId);
  const settings =
    typeof (project as { settings?: unknown }).settings === "string"
      ? (JSON.parse((project as { settings: string }).settings) as Record<string, unknown>)
      : ((project as { settings?: Record<string, unknown> }).settings ?? {});
  const subjects = Array.isArray(settings.figurineSubjects)
    ? (settings.figurineSubjects as Record<string, unknown>[])
    : [];
  const nextSubjects = subjects.map((s) =>
    s.id === "primary"
      ? {
          ...s,
          status: "provider_queued",
          progress: 10,
          provider: "tripo",
          providerTaskId,
          jobId,
          failureCode: undefined,
          failureMessage: undefined
        }
      : s
  );

  await db.updateDocument(databaseId, projectsCollection, projectId, {
    mode: "figurine_3d",
    status: "processing",
    settings: JSON.stringify({
      ...settings,
      figurineSubjects: nextSubjects.length
        ? nextSubjects
        : [
            {
              id: "primary",
              sourceFileId: (project as { source_image_path?: string }).source_image_path,
              status: "provider_queued",
              progress: 10,
              provider: "tripo",
              providerTaskId,
              jobId
            }
          ]
    })
  });

  console.log(
    JSON.stringify(
      {
        action: "reopened_for_controlled_retopo",
        jobId,
        projectId,
        providerTaskId,
        retopoTaskId: retopoTaskId || null,
        newImageTo3d: false,
        publish: false
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
