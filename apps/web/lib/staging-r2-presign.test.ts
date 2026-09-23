import { describe, expect, it, vi } from "vitest";
import {
  FIGURE_STAGING_BUCKET_NAME,
  FIGURE_STAGING_GLB_PRESIGN_TTL_SEC,
  FIGURE_STAGING_USDZ_PRESIGN_TTL_SEC,
  figureStagingGlbKey,
  figureStagingUsdzKey
} from "@kidar/core";
import {
  assertStagingRuntimeForFigures,
  presignFigureAssetGets,
  resolveStagingR2PresignConfig
} from "./staging-r2-presign";

const stagingEnv = {
  KIDAR_RUNTIME_ENV: "staging",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "AKIA_TEST",
  R2_SECRET_ACCESS_KEY: "secret_test_value",
  R2_STAGING_BUCKET: FIGURE_STAGING_BUCKET_NAME,
  R2_BUCKET: FIGURE_STAGING_BUCKET_NAME,
  R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: "appwrite-staging",
  KIDAR_PRODUCTION_APPWRITE_PROJECT_ID: "appwrite-prod"
};

describe("staging R2 presign", () => {
  it("requires staging runtime", () => {
    expect(() => assertStagingRuntimeForFigures({})).toThrow(/staging/i);
    expect(() => assertStagingRuntimeForFigures({ KIDAR_RUNTIME_ENV: "production" })).toThrow(
      /staging/i
    );
    expect(() =>
      assertStagingRuntimeForFigures({ KIDAR_RUNTIME_ENV: "staging" })
    ).not.toThrow();
  });

  it("refuses production Appwrite, wrong bucket, and R2_PUBLIC_BASE_URL", () => {
    expect(() =>
      resolveStagingR2PresignConfig({
        ...stagingEnv,
        NEXT_PUBLIC_APPWRITE_PROJECT_ID: "appwrite-prod"
      })
    ).toThrow(/production Appwrite/i);

    expect(() =>
      resolveStagingR2PresignConfig({
        ...stagingEnv,
        R2_BUCKET: "kidar-public-ar",
        R2_STAGING_BUCKET: "kidar-public-ar"
      })
    ).toThrow(/dedicated staging/i);

    expect(() =>
      resolveStagingR2PresignConfig({
        ...stagingEnv,
        R2_PUBLIC_BASE_URL: "https://cdn.example.com"
      })
    ).toThrow(/R2_PUBLIC_BASE_URL/i);
  });

  it("signs only derived staging keys with short TTLs", async () => {
    const calls: Array<{ key: string; expiresIn: number }> = [];
    const signed = await presignFigureAssetGets({
      projectId: "proj_1",
      glbKey: figureStagingGlbKey("proj_1", "job_abc"),
      usdzKey: figureStagingUsdzKey("proj_1", "job_abc"),
      env: stagingEnv,
      now: new Date("2026-09-23T11:00:00.000Z"),
      signGetObject: async ({ key, expiresIn }) => {
        calls.push({ key, expiresIn });
        return `https://acct.r2.cloudflarestorage.com/${FIGURE_STAGING_BUCKET_NAME}/${key}?X-Amz-Signature=test`;
      }
    });

    expect(calls).toEqual([
      {
        key: "staging/projects/proj_1/figures/job_abc/model.glb",
        expiresIn: FIGURE_STAGING_GLB_PRESIGN_TTL_SEC
      },
      {
        key: "staging/projects/proj_1/figures/job_abc/model.usdz",
        expiresIn: FIGURE_STAGING_USDZ_PRESIGN_TTL_SEC
      }
    ]);
    expect(signed.glbUrl).toContain("model.glb");
    expect(signed.usdzUrl).toContain("model.usdz");
    expect(signed.expiresAt).toBe("2026-09-23T11:10:00.000Z");
    expect(JSON.stringify(signed)).not.toMatch(/secret_test_value|AKIA_TEST|SECRET_ACCESS/i);
  });

  it("rejects malicious keys before signing", async () => {
    const sign = vi.fn(async () => "https://example.com/x");
    await expect(
      presignFigureAssetGets({
        projectId: "proj_1",
        glbKey: "staging/projects/other/figures/job/model.glb",
        usdzKey: figureStagingUsdzKey("proj_1", "job_abc"),
        env: stagingEnv,
        signGetObject: sign
      })
    ).rejects.toThrow(/prefix/i);
    expect(sign).not.toHaveBeenCalled();

    await expect(
      presignFigureAssetGets({
        projectId: "proj_1",
        glbKey: "staging/projects/proj_1/figures/../evil/model.glb",
        usdzKey: figureStagingUsdzKey("proj_1", "job_abc"),
        env: stagingEnv,
        signGetObject: sign
      })
    ).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });
});
