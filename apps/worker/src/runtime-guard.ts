/**
 * Fail-closed startup guard for a worker that is declared as staging.
 *
 * The worker claims jobs from whichever Appwrite project its environment points
 * to, so the only thing separating a staging worker from the production queue is
 * its configuration. When KIDAR_RUNTIME_ENV=staging this guard refuses to start
 * unless the configuration is provably a test setup. It never reads or logs the
 * values of secrets: violations name variables only.
 *
 * Outside staging (variable unset or any other value) the guard is a no-op, so
 * the production worker behaves exactly as before.
 */

import {
  FIGURE_FLAG_AR,
  FIGURE_FLAG_GENERATION,
  FIGURE_FLAG_GENERATION_ALIAS,
  FIGURE_FLAG_PUBLISH,
  FIGURE_STAGING_BUCKET_NAME
} from "@kidar/core";

type Env = Record<string, string | undefined>;

export const WORKER_RUNTIME_ENV_VAR = "KIDAR_RUNTIME_ENV";
export const WORKER_STAGING_RUNTIME = "staging";
export const WORKER_PRODUCTION_APPWRITE_GUARD_VAR = "KIDAR_PRODUCTION_APPWRITE_PROJECT_ID";
/** Text-to-3D flag (web + worker); kept here to avoid importing web code. */
const FLAG_TEXT_3D = "FIGURE_TEXT_3D_ENABLED";

export class WorkerRuntimeGuardError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      `Worker refused to start in staging: ${violations.join("; ")}. ` +
        "Fix the environment variables (names only are reported, values are never logged)."
    );
    this.name = "WorkerRuntimeGuardError";
    this.violations = violations;
  }
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function present(value: string | undefined): boolean {
  return clean(value).length > 0;
}

/** Any value that could switch a flag on ("true", "1", "yes", ... ). Stricter than the app gates. */
function flagLooksOn(value: string | undefined): boolean {
  const v = clean(value).toLowerCase();
  return v !== "" && v !== "false" && v !== "0" && v !== "off" && v !== "no";
}

export function isStagingWorkerRuntime(env: Env = process.env): boolean {
  return clean(env[WORKER_RUNTIME_ENV_VAR]).toLowerCase() === WORKER_STAGING_RUNTIME;
}

/** Returns human-readable violations (variable names only). Empty when safe or not staging. */
export function listStagingWorkerViolations(env: Env = process.env): string[] {
  if (!isStagingWorkerRuntime(env)) return [];
  const violations: string[] = [];

  const production = clean(env[WORKER_PRODUCTION_APPWRITE_GUARD_VAR]);
  if (!production) {
    violations.push(`${WORKER_PRODUCTION_APPWRITE_GUARD_VAR} must be set so the production project can be refused`);
  }

  const publicId = clean(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
  const serverId = clean(env.APPWRITE_PROJECT_ID);
  if (!publicId && !serverId) {
    violations.push("an Appwrite project id (NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_PROJECT_ID) is required");
  }
  if (publicId && serverId && publicId !== serverId) {
    violations.push("NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_PROJECT_ID must be identical");
  }
  if (production) {
    if (publicId && publicId === production) {
      violations.push(
        `NEXT_PUBLIC_APPWRITE_PROJECT_ID points at the project named by ${WORKER_PRODUCTION_APPWRITE_GUARD_VAR}`
      );
    }
    if (serverId && serverId === production) {
      violations.push(
        `APPWRITE_PROJECT_ID points at the project named by ${WORKER_PRODUCTION_APPWRITE_GUARD_VAR}`
      );
    }
  }
  if (!present(env.APPWRITE_API_KEY)) {
    violations.push("APPWRITE_API_KEY is required");
  }

  if (clean(env.R2_BUCKET) !== FIGURE_STAGING_BUCKET_NAME) {
    violations.push(`R2_BUCKET must be the dedicated staging bucket (${FIGURE_STAGING_BUCKET_NAME})`);
  }
  if (clean(env.R2_STAGING_BUCKET) !== FIGURE_STAGING_BUCKET_NAME) {
    violations.push(`R2_STAGING_BUCKET must be the dedicated staging bucket (${FIGURE_STAGING_BUCKET_NAME})`);
  }
  if (present(env.R2_PUBLIC_BASE_URL)) {
    violations.push("R2_PUBLIC_BASE_URL must not be set in staging");
  }
  // publishStorageEnv() lets PUBLISH_R2_* override R2_BUCKET / R2_PUBLIC_BASE_URL for every
  // public write the worker does, so they could silently redirect staging to a public bucket.
  if (present(env.PUBLISH_R2_BUCKET)) {
    violations.push("PUBLISH_R2_BUCKET must not be set in staging (it overrides R2_BUCKET for public writes)");
  }
  if (present(env.PUBLISH_R2_PUBLIC_BASE_URL)) {
    violations.push(
      "PUBLISH_R2_PUBLIC_BASE_URL must not be set in staging (it overrides R2_PUBLIC_BASE_URL for public writes)"
    );
  }

  if (present(env.TRIPO_API_KEY)) {
    violations.push("TRIPO_API_KEY must not be set in staging");
  }
  for (const flag of [
    FIGURE_FLAG_GENERATION,
    FIGURE_FLAG_GENERATION_ALIAS,
    FIGURE_FLAG_PUBLISH,
    FIGURE_FLAG_AR,
    FLAG_TEXT_3D
  ]) {
    if (flagLooksOn(env[flag])) {
      violations.push(`${flag} must be off or unset in staging`);
    }
  }

  return violations;
}

/** Throws WorkerRuntimeGuardError when this is a staging worker with an unsafe configuration. */
export function assertWorkerRuntimeGuard(env: Env = process.env): void {
  const violations = listStagingWorkerViolations(env);
  if (violations.length > 0) {
    throw new WorkerRuntimeGuardError(violations);
  }
}
