import { describe, expect, it } from "vitest";
import {
  WorkerRuntimeGuardError,
  assertWorkerRuntimeGuard,
  isStagingWorkerRuntime,
  listStagingWorkerViolations
} from "./runtime-guard";

const PROD_ID = "prod-project-id";
const STAGING_ID = "staging-project-id";

function safeStagingEnv(): Record<string, string | undefined> {
  return {
    KIDAR_RUNTIME_ENV: "staging",
    KIDAR_PRODUCTION_APPWRITE_PROJECT_ID: PROD_ID,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: STAGING_ID,
    APPWRITE_PROJECT_ID: STAGING_ID,
    APPWRITE_API_KEY: "test-key",
    R2_BUCKET: "kidar-figures-staging",
    R2_STAGING_BUCKET: "kidar-figures-staging",
    FIGURE_GENERATION_ENABLED: "false",
    FIGURE_PUBLISH_ENABLED: "false",
    FIGURE_AR_ENABLED: "false"
  };
}

describe("worker runtime guard", () => {
  it("is a no-op outside staging, whatever the configuration", () => {
    expect(isStagingWorkerRuntime({})).toBe(false);
    expect(listStagingWorkerViolations({})).toEqual([]);
    expect(
      listStagingWorkerViolations({
        APPWRITE_PROJECT_ID: PROD_ID,
        TRIPO_API_KEY: "x",
        FIGURE_GENERATION_ENABLED: "true"
      })
    ).toEqual([]);
    expect(() => assertWorkerRuntimeGuard({ KIDAR_RUNTIME_ENV: "production" })).not.toThrow();
  });

  it("accepts a safe staging configuration", () => {
    expect(isStagingWorkerRuntime(safeStagingEnv())).toBe(true);
    expect(listStagingWorkerViolations(safeStagingEnv())).toEqual([]);
    expect(() => assertWorkerRuntimeGuard(safeStagingEnv())).not.toThrow();
  });

  it("treats the staging marker case-insensitively and trims it", () => {
    expect(isStagingWorkerRuntime({ KIDAR_RUNTIME_ENV: " Staging " })).toBe(true);
  });

  it("refuses when the production guard variable is missing", () => {
    const env = safeStagingEnv();
    delete env.KIDAR_PRODUCTION_APPWRITE_PROJECT_ID;
    expect(listStagingWorkerViolations(env).join(" ")).toContain("KIDAR_PRODUCTION_APPWRITE_PROJECT_ID");
  });

  it("refuses the production Appwrite project through either variable", () => {
    const publicSide = { ...safeStagingEnv(), NEXT_PUBLIC_APPWRITE_PROJECT_ID: PROD_ID, APPWRITE_PROJECT_ID: undefined };
    expect(listStagingWorkerViolations(publicSide).join(" ")).toContain("NEXT_PUBLIC_APPWRITE_PROJECT_ID points at");
    const serverSide = { ...safeStagingEnv(), NEXT_PUBLIC_APPWRITE_PROJECT_ID: undefined, APPWRITE_PROJECT_ID: PROD_ID };
    expect(listStagingWorkerViolations(serverSide).join(" ")).toContain("APPWRITE_PROJECT_ID points at");
  });

  it("refuses mismatching or missing project ids and a missing API key", () => {
    const mismatch = { ...safeStagingEnv(), APPWRITE_PROJECT_ID: "another-staging-id" };
    expect(listStagingWorkerViolations(mismatch).join(" ")).toContain("must be identical");
    const none = { ...safeStagingEnv(), NEXT_PUBLIC_APPWRITE_PROJECT_ID: undefined, APPWRITE_PROJECT_ID: undefined };
    expect(listStagingWorkerViolations(none).join(" ")).toContain("project id");
    const noKey = { ...safeStagingEnv(), APPWRITE_API_KEY: "  " };
    expect(listStagingWorkerViolations(noKey).join(" ")).toContain("APPWRITE_API_KEY is required");
  });

  it("refuses any R2 bucket other than the dedicated staging bucket", () => {
    const wrongBucket = { ...safeStagingEnv(), R2_BUCKET: "some-other-bucket" };
    expect(listStagingWorkerViolations(wrongBucket).join(" ")).toContain("R2_BUCKET must be");
    const wrongStaging = { ...safeStagingEnv(), R2_STAGING_BUCKET: "some-other-bucket" };
    expect(listStagingWorkerViolations(wrongStaging).join(" ")).toContain("R2_STAGING_BUCKET must be");
    const missing = { ...safeStagingEnv(), R2_BUCKET: undefined, R2_STAGING_BUCKET: undefined };
    expect(listStagingWorkerViolations(missing)).toHaveLength(2);
  });

  it("refuses a public R2 base URL", () => {
    const env = { ...safeStagingEnv(), R2_PUBLIC_BASE_URL: "https://cdn.example.test" };
    expect(listStagingWorkerViolations(env).join(" ")).toContain("R2_PUBLIC_BASE_URL");
  });

  it("refuses a Tripo key", () => {
    const env = { ...safeStagingEnv(), TRIPO_API_KEY: "tripo-secret" };
    expect(listStagingWorkerViolations(env).join(" ")).toContain("TRIPO_API_KEY");
  });

  it("refuses any flag that looks on, including aliases and sloppy values", () => {
    for (const [name, value] of [
      ["FIGURE_GENERATION_ENABLED", "true"],
      ["FIGURINE_3D_ENABLED", "1"],
      ["FIGURE_PUBLISH_ENABLED", "TRUE"],
      ["FIGURE_AR_ENABLED", "yes"],
      ["FIGURE_TEXT_3D_ENABLED", "true"]
    ] as const) {
      const env = { ...safeStagingEnv(), [name]: value };
      expect(listStagingWorkerViolations(env).join(" ")).toContain(`${name} must be off`);
    }
    for (const off of ["false", "0", "off", "no", "", undefined]) {
      expect(
        listStagingWorkerViolations({ ...safeStagingEnv(), FIGURE_GENERATION_ENABLED: off })
      ).toEqual([]);
    }
  });

  it("throws a typed error that never contains secret values", () => {
    const env = {
      ...safeStagingEnv(),
      APPWRITE_API_KEY: "super-secret-appwrite-key",
      TRIPO_API_KEY: "super-secret-tripo-key",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: PROD_ID,
      APPWRITE_PROJECT_ID: PROD_ID
    };
    try {
      assertWorkerRuntimeGuard(env);
      throw new Error("expected the guard to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkerRuntimeGuardError);
      const message = (error as Error).message;
      expect(message).not.toContain("super-secret-appwrite-key");
      expect(message).not.toContain("super-secret-tripo-key");
      expect(message).not.toContain(PROD_ID);
      expect((error as WorkerRuntimeGuardError).violations.length).toBeGreaterThan(1);
    }
  });
});
