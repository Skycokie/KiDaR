import { describe, expect, it } from "vitest";
import { PublicStorageConfigError } from "@kidar/core";
import {
  APPROVED_AR_RUNTIME_ASSETS,
  assertApprovedRuntimeAsset,
  publishApprovedArRuntimeScripts
} from "./publish-runtime";
import { MemoryPublicArtifactStorage } from "./public";

describe("publishApprovedArRuntimeScripts", () => {
  it("allowlists only the two approved runtime keys and checksums", () => {
    expect(APPROVED_AR_RUNTIME_ASSETS.map((asset) => asset.key)).toEqual([
      "runtime/aframe-1.5.0-master.min.js",
      "runtime/mindar-image-aframe-1.2.5.prod.js"
    ]);
    expect(APPROVED_AR_RUNTIME_ASSETS[0].sha256).toBe(
      "14505830827befef85276e7f7548d2a5f3e04b91b24358e2e7535e42dafc80be"
    );
    expect(APPROVED_AR_RUNTIME_ASSETS[1].sha256).toBe(
      "42764d6f1b39387f5786b9c4cfbe50883e13ca3f47b42bf1e54e84510b374013"
    );
    const aframe = new TextEncoder().encode("aframe-bytes");
    expect(() =>
      assertApprovedRuntimeAsset(
        "runtime/aframe-1.5.0-master.min.js",
        APPROVED_AR_RUNTIME_ASSETS[0].sha256,
        aframe
      )
    ).toThrow(/mismatch/);
    expect(() =>
      assertApprovedRuntimeAsset("pages/x/index.html", APPROVED_AR_RUNTIME_ASSETS[0].sha256, aframe)
    ).toThrow(/allowlist/);
    expect(() =>
      assertApprovedRuntimeAsset(
        "experiences/m44b-uv-demo/target.txt",
        APPROVED_AR_RUNTIME_ASSETS[0].sha256,
        aframe
      )
    ).toThrow(/allowlist/);
    expect(() =>
      assertApprovedRuntimeAsset("models/x/popout.glb", APPROVED_AR_RUNTIME_ASSETS[0].sha256, aframe)
    ).toThrow(/allowlist/);
  });

  it("does not write when the fetched body hash does not match the approval", async () => {
    const storage = new MemoryPublicArtifactStorage("https://cdn.example.com");
    await expect(
      publishApprovedArRuntimeScripts({
        write: true,
        storage,
        fetchBody: async () => new TextEncoder().encode("not-the-approved-bytes")
      })
    ).rejects.toBeInstanceOf(PublicStorageConfigError);
    expect(await storage.getMetadata("runtime/aframe-1.5.0-master.min.js")).toBeNull();
    expect(await storage.getMetadata("experiences/m44b-uv-demo/target.txt")).toBeNull();
  });
});
