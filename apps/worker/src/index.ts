import {
  MindCompileError,
  PopoutBuildError,
  PublicStorageConfigError,
  type PipelineJob
} from "@kidar/core";
import { claimNextJob, failJob } from "./appwrite/jobs";
import { createWorkerPublicStorage } from "./storage/public";
import { handlePopoutJobFailure, runPopoutBuildStage } from "./popout/stage";
import { handleMindJobFailure, runMindCompileStage } from "./mindar/stage";

export interface AI3DProvider {
  generateModel(input: { imagePath: string }): Promise<{ glbPath: string }>;
}

export function getOptionalAI3DProvider(): AI3DProvider | null {
  return process.env.AI3D_API_KEY ? null : null;
}

function pollIntervalMs(): number {
  const raw = Number(process.env.WORKER_POLL_INTERVAL_MS || 1000);
  return Number.isFinite(raw) && raw >= 250 ? raw : 1000;
}

function idleBackoffMs(emptyStreak: number): number {
  const base = pollIntervalMs();
  return Math.min(base * Math.max(1, emptyStreak), 15_000);
}

async function failUnsupportedJob(job: PipelineJob): Promise<void> {
  if (!job.lockToken) return;
  await failJob({
    jobId: job.id,
    lockToken: job.lockToken,
    error: `Unsupported job type: ${job.type}`,
    terminal: true
  });
}

async function processClaimedJob(job: PipelineJob): Promise<void> {
  if (job.type === "popout_build") {
    try {
      const storage = createWorkerPublicStorage();
      await runPopoutBuildStage(job, { storage });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Lock token mismatch")) {
        return;
      }
      await handlePopoutJobFailure(job, error);
    }
    return;
  }

  if (job.type === "mind_compile") {
    try {
      const storage = createWorkerPublicStorage();
      await runMindCompileStage(job, { storage });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Lock token mismatch")) {
        return;
      }
      await handleMindJobFailure(job, error);
    }
    return;
  }

  await failUnsupportedJob(job);
}

/** Process at most one eligible job (tests / one-shot runs). */
export async function runWorkerOnce(): Promise<"processed" | "idle"> {
  const job = await claimNextJob();
  if (!job) return "idle";
  await processClaimedJob(job);
  return "processed";
}

/** Polling loop for Railway / local worker. */
export async function runWorkerLoop(signal?: AbortSignal): Promise<void> {
  let emptyStreak = 0;
  console.log(
    `[worker] polling for popout_build|mind_compile jobs every ${pollIntervalMs()}ms (backoff when idle)`
  );
  while (!signal?.aborted) {
    try {
      const result = await runWorkerOnce();
      if (result === "idle") {
        emptyStreak += 1;
        await sleep(idleBackoffMs(emptyStreak));
      } else {
        emptyStreak = 0;
      }
    } catch (error) {
      if (error instanceof PublicStorageConfigError) {
        console.error(`[worker] public storage misconfigured: ${error.message}`);
        await sleep(idleBackoffMs(5));
        continue;
      }
      if (error instanceof PopoutBuildError || error instanceof MindCompileError) {
        console.error(`[worker] stage error (${error.code}): ${error.message}`);
      }
      console.error("[worker] loop error", error);
      await sleep(idleBackoffMs(3));
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isMain) {
  const once = process.argv.includes("--once");
  if (once) {
    runWorkerOnce()
      .then((result) => {
        console.log(`[worker] once: ${result}`);
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  } else {
    const controller = new AbortController();
    process.on("SIGINT", () => controller.abort());
    process.on("SIGTERM", () => controller.abort());
    runWorkerLoop(controller.signal).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
