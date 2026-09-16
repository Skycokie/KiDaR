import { describe, expect, it } from "vitest";
import {
  PublicStorageConfigError,
  createPublicArtifactStorage,
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

  it("accepts complete R2 configuration and returns unimplemented adapter", async () => {
    const config = resolvePublicStorageConfig({
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "ak",
      R2_SECRET_ACCESS_KEY: "sk",
      R2_BUCKET: "kidar-ar",
      R2_PUBLIC_BASE_URL: "https://cdn.example.com"
    });
    expect(config.provider).toBe("r2");
    const storage = createPublicArtifactStorage({
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "ak",
      R2_SECRET_ACCESS_KEY: "sk",
      R2_BUCKET: "kidar-ar",
      R2_PUBLIC_BASE_URL: "https://cdn.example.com"
    });
    expect(storage.getPublicUrl("a/b.glb")).toBe("https://cdn.example.com/a/b.glb");
    await expect(
      storage.write({ key: "a/b.glb", body: new Uint8Array([1]), contentType: "model/gltf-binary" })
    ).rejects.toThrow(/not implemented in M4.1/);
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
