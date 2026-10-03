import { describe, expect, it } from "vitest";
import {
  PublicStorageConfigError,
  createPublicArtifactStorage,
  publishPublicBaseUrl,
  publishStorageEnv,
  resolvePublicStorageConfig
} from "./storage";

describe("public storage configuration", () => {
  it("rejects when no public provider is configured", () => {
    expect(() =>
      resolvePublicStorageConfig({
        APPWRITE_SOURCE_BUCKET: "source-drawings",
        APPWRITE_ASSETS_BUCKET: "source-drawings"
      })
    ).toThrow(PublicStorageConfigError);
  });

  it("rejects Appwrite fallback when assets bucket equals source bucket", () => {
    expect(() =>
      resolvePublicStorageConfig({
        PUBLIC_ARTIFACT_STORAGE: "appwrite",
        APPWRITE_SOURCE_BUCKET: "source-drawings",
        APPWRITE_ASSETS_BUCKET: "source-drawings",
        NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://example.appwrite.io/v1",
        NEXT_PUBLIC_APPWRITE_PROJECT_ID: "proj",
        APPWRITE_API_KEY: "key"
      })
    ).toThrow(/must differ from APPWRITE_SOURCE_BUCKET/);
  });

  it("rejects incomplete R2 configuration", () => {
    expect(() =>
      resolvePublicStorageConfig({
        PUBLIC_ARTIFACT_STORAGE: "r2",
        R2_ACCOUNT_ID: "acct",
        R2_BUCKET: "bucket"
      })
    ).toThrow(/R2_ACCESS_KEY_ID/);
  });

  it("accepts complete R2 configuration and keeps writes off the config handle", async () => {
    const config = resolvePublicStorageConfig({
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "ak",
      R2_SECRET_ACCESS_KEY: "sk",
      R2_BUCKET: "kidar-public-ar",
      R2_PUBLIC_BASE_URL: "https://ar.example.com"
    });
    expect(config.provider).toBe("r2");
    if (config.provider === "r2") {
      expect(config.endpoint).toBe("https://acct.r2.cloudflarestorage.com");
      expect(config.publicBaseUrl).toBe("https://ar.example.com");
    }
    const storage = createPublicArtifactStorage({
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "ak",
      R2_SECRET_ACCESS_KEY: "sk",
      R2_BUCKET: "kidar-public-ar",
      R2_PUBLIC_BASE_URL: "https://ar.example.com"
    });
    expect(storage.getPublicUrl("a/b.glb")).toBe("https://ar.example.com/a/b.glb");
    await expect(
      storage.write({ key: "a/b.glb", body: new Uint8Array([1]), contentType: "model/gltf-binary" })
    ).rejects.toThrow(/worker R2 adapter/i);
  });

  it("rejects using the R2 S3 API host as the public base URL", () => {
    expect(() =>
      resolvePublicStorageConfig({
        PUBLIC_ARTIFACT_STORAGE: "r2",
        R2_ACCOUNT_ID: "acct",
        R2_ACCESS_KEY_ID: "ak",
        R2_SECRET_ACCESS_KEY: "sk",
        R2_BUCKET: "kidar-public-ar",
        R2_PUBLIC_BASE_URL: "https://acct.r2.cloudflarestorage.com"
      })
    ).toThrow(/public HTTPS delivery origin|must differ from R2_ENDPOINT/i);
  });

  it("accepts Appwrite fallback only with a distinct assets bucket", () => {
    const config = resolvePublicStorageConfig({
      PUBLIC_ARTIFACT_STORAGE: "appwrite",
      APPWRITE_SOURCE_BUCKET: "source-drawings",
      APPWRITE_ASSETS_BUCKET: "public-ar",
      NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://example.appwrite.io/v1",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: "proj",
      APPWRITE_API_KEY: "key"
    });
    expect(config).toEqual({
      provider: "appwrite",
      endpoint: "https://example.appwrite.io/v1",
      projectId: "proj",
      apiKey: "key",
      bucketId: "public-ar"
    });
  });
});

describe("publish storage env", () => {
  const figureStaging = {
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "kidar-figures-staging",
    R2_STAGING_BUCKET: "kidar-figures-staging"
  };

  it("leaves env untouched without publish overrides", () => {
    const env = { ...figureStaging, R2_BUCKET: "kidar-public-ar", R2_PUBLIC_BASE_URL: "https://ar.example.com" };
    expect(publishStorageEnv(env)).toBe(env);
  });

  it("routes publish to its own bucket while figure staging stays private", () => {
    const env = {
      ...figureStaging,
      PUBLISH_R2_BUCKET: "kidar-public-staging",
      PUBLISH_R2_PUBLIC_BASE_URL: "https://pub-abc.r2.dev"
    };
    const view = publishStorageEnv(env);
    expect(view.R2_BUCKET).toBe("kidar-public-staging");
    expect(view.R2_PUBLIC_BASE_URL).toBe("https://pub-abc.r2.dev");
    expect(env.R2_BUCKET).toBe("kidar-figures-staging");
    expect(env).not.toHaveProperty("R2_PUBLIC_BASE_URL");
    expect(resolvePublicStorageConfig(view)).toMatchObject({ bucket: "kidar-public-staging" });
  });

  it("requires both publish overrides together", () => {
    expect(() => publishStorageEnv({ ...figureStaging, PUBLISH_R2_PUBLIC_BASE_URL: "https://pub-abc.r2.dev" })).toThrow(
      PublicStorageConfigError
    );
    expect(() => publishStorageEnv({ ...figureStaging, PUBLISH_R2_BUCKET: "kidar-public-staging" })).toThrow(
      PublicStorageConfigError
    );
    expect(publishPublicBaseUrl({ ...figureStaging, PUBLISH_R2_BUCKET: "kidar-public-staging" })).toBeUndefined();
  });

  it("refuses to publish into the private figure staging bucket", () => {
    expect(() =>
      publishStorageEnv({
        ...figureStaging,
        PUBLISH_R2_BUCKET: "kidar-figures-staging",
        PUBLISH_R2_PUBLIC_BASE_URL: "https://pub-abc.r2.dev"
      })
    ).toThrow(/kidar-figures-staging/);
  });
});
