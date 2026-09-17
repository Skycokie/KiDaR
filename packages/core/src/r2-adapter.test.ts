import { describe, expect, it } from "vitest";
import { MemoryR2ObjectStore, R2PublicArtifactStorage } from "./r2-adapter";
import {
  IMMUTABLE_CACHE_CONTROL,
  PUBLIC_ARTIFACT_CONTENT_TYPES
} from "./storage-keys";
import type { R2PublicStorageConfig } from "./storage";

const config = (): R2PublicStorageConfig => ({
  provider: "r2",
  accountId: "acct123",
  accessKeyId: "ak",
  secretAccessKey: "sk",
  bucket: "kidar-public-ar",
  publicBaseUrl: "https://ar.example.com",
  endpoint: "https://acct123.r2.cloudflarestorage.com"
});

describe("R2PublicArtifactStorage", () => {
  it("writes with content-type and immutable cache-control, then heads metadata", async () => {
    const store = new MemoryR2ObjectStore();
    const storage = new R2PublicArtifactStorage(config(), store);
    const body = new Uint8Array([1, 2, 3, 4]);
    const result = await storage.write({
      key: "models/p1/abc/popout.glb",
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.glb,
      checksum: "deadbeef"
    });

    expect(result.key).toBe("models/p1/abc/popout.glb");
    expect(result.publicUrl).toBe("https://ar.example.com/models/p1/abc/popout.glb");
    expect(result.publicUrl.includes("?")).toBe(false);

    const written = store.objects.get("models/p1/abc/popout.glb");
    expect(written?.contentType).toBe("model/gltf-binary");
    expect(written?.cacheControl).toBe(IMMUTABLE_CACHE_CONTROL);

    await expect(storage.exists("models/p1/abc/popout.glb")).resolves.toBe(true);
    const meta = await storage.getMetadata("models/p1/abc/popout.glb");
    expect(meta).toMatchObject({
      key: "models/p1/abc/popout.glb",
      size: 4,
      contentType: "model/gltf-binary",
      checksum: "deadbeef"
    });
  });

  it("maps html/mind/png/pdf/mp3 content types when the caller provides them", async () => {
    const store = new MemoryR2ObjectStore();
    const storage = new R2PublicArtifactStorage(config(), store);
    const body = new Uint8Array([9]);
    await storage.write({
      key: "projects/p1/abc/ar.html",
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.html
    });
    await storage.write({
      key: "targets/p1/abc/targets.mind",
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.mind
    });
    await storage.write({
      key: "projects/p1/abc/qr.png",
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.png
    });
    await storage.write({
      key: "projects/p1/abc/print.pdf",
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.pdf
    });
    await storage.write({
      key: "projects/p1/abc/sound.mp3",
      body,
      contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.mp3
    });
    expect(store.objects.get("projects/p1/abc/ar.html")?.contentType).toBe(
      "text/html; charset=utf-8"
    );
    expect(store.objects.get("targets/p1/abc/targets.mind")?.contentType).toBe(
      "application/octet-stream"
    );
  });

  it("propagates store failures instead of treating them as missing objects", async () => {
    const store = new MemoryR2ObjectStore();
    store.lastError = new Error("upstream 503");
    const storage = new R2PublicArtifactStorage(config(), store);
    await expect(storage.exists("models/p1/abc/popout.glb")).rejects.toThrow(/503/);
    await expect(
      storage.write({
        key: "models/p1/abc/popout.glb",
        body: new Uint8Array([1]),
        contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.glb
      })
    ).rejects.toThrow(/503/);
  });

  it("rejects traversal keys before talking to the store", async () => {
    const store = new MemoryR2ObjectStore();
    const storage = new R2PublicArtifactStorage(config(), store);
    expect(() => storage.getPublicUrl("../secrets")).toThrow(/traversal/i);
    await expect(
      storage.write({
        key: "models/%2e%2e/x.glb",
        body: new Uint8Array([1]),
        contentType: PUBLIC_ARTIFACT_CONTENT_TYPES.glb
      })
    ).rejects.toThrow(/traversal/i);
    expect(store.objects.size).toBe(0);
  });
});
