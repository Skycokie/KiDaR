import { describe, expect, it } from "vitest";
import {
  PublicObjectKeyError,
  assertR2UrlRoles,
  defaultR2ApiEndpoint,
  normalizePublicObjectKey,
  publicArtifactUrl
} from "./storage-keys";
import { PublicStorageConfigError } from "./storage-error";

describe("normalizePublicObjectKey", () => {
  it("returns a stable key without a leading slash", () => {
    expect(normalizePublicObjectKey("projects/abc/hash/popout.glb")).toBe(
      "projects/abc/hash/popout.glb"
    );
  });

  it("rejects traversal, encoded traversal, query strings, and credentials", () => {
    expect(() => normalizePublicObjectKey("/models/a.glb")).toThrow(PublicObjectKeyError);
    expect(() => normalizePublicObjectKey("models/../secret.glb")).toThrow(/traversal/i);
    expect(() => normalizePublicObjectKey("models/%2e%2e/secret.glb")).toThrow(/traversal/i);
    expect(() => normalizePublicObjectKey("models/a.glb?X-Amz-Signature=abc")).toThrow(/query/i);
    expect(() => normalizePublicObjectKey("user:pass@models/a.glb")).toThrow(/credentials|scheme/i);
    expect(() => normalizePublicObjectKey("https://cdn.example.com/a.glb")).toThrow(/scheme/i);
  });
});

describe("publicArtifactUrl", () => {
  it("builds a deterministic unsigned HTTPS URL", () => {
    expect(publicArtifactUrl("https://ar.example.com", "models/p1/abc/popout.glb")).toBe(
      "https://ar.example.com/models/p1/abc/popout.glb"
    );
    expect(publicArtifactUrl("https://ar.example.com/", "models/p1/abc/popout.glb")).toBe(
      "https://ar.example.com/models/p1/abc/popout.glb"
    );
  });

  it("never adds signed query parameters", () => {
    const href = publicArtifactUrl("https://ar.example.com", "targets/p1/abc/targets.mind");
    expect(href.includes("?")).toBe(false);
    expect(href.toLowerCase().includes("x-amz-signature")).toBe(false);
    expect(href.toLowerCase().includes("token=")).toBe(false);
  });

  it("rejects the S3-compatible API host as a public origin", () => {
    expect(() =>
      publicArtifactUrl("https://acct.r2.cloudflarestorage.com", "models/a.glb")
    ).toThrow(/public HTTPS delivery origin/i);
  });
});

describe("assertR2UrlRoles", () => {
  it("defaults the API endpoint from the account id and keeps it distinct from the CDN origin", () => {
    const roles = assertR2UrlRoles({
      publicBaseUrl: "https://ar.example.com",
      accountId: "acct123"
    });
    expect(roles.publicBaseUrl).toBe("https://ar.example.com");
    expect(roles.endpoint).toBe(defaultR2ApiEndpoint("acct123"));
    expect(roles.endpoint).toBe("https://acct123.r2.cloudflarestorage.com");
  });

  it("rejects using the API endpoint as R2_PUBLIC_BASE_URL", () => {
    expect(() =>
      assertR2UrlRoles({
        publicBaseUrl: "https://acct123.r2.cloudflarestorage.com",
        accountId: "acct123"
      })
    ).toThrow(PublicStorageConfigError);
  });
});
