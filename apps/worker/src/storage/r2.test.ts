import { describe, expect, it } from "vitest";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3R2ObjectStore } from "./public";
import { IMMUTABLE_CACHE_CONTROL } from "@kidar/core";

describe("S3R2ObjectStore", () => {
  it("maps put/head to unsigned bucket commands with cache-control metadata", async () => {
    const sent: unknown[] = [];
    const client = {
      send: async (command: unknown) => {
        sent.push(command);
        if (command instanceof HeadObjectCommand) {
          return {
            ContentLength: 4,
            ContentType: "model/gltf-binary",
            CacheControl: IMMUTABLE_CACHE_CONTROL,
            Metadata: { checksum: "abc" },
            LastModified: new Date("2026-09-17T00:00:00.000Z")
          };
        }
        return {};
      }
    };
    const store = new S3R2ObjectStore(client as never, "kidar-public-ar");
    await store.put({
      key: "models/p1/abc/popout.glb",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "model/gltf-binary",
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      checksum: "abc"
    });
    const head = await store.head("models/p1/abc/popout.glb");
    expect(sent[0]).toBeInstanceOf(PutObjectCommand);
    expect(sent[1]).toBeInstanceOf(HeadObjectCommand);
    expect(head).toMatchObject({
      size: 4,
      contentType: "model/gltf-binary",
      checksum: "abc",
      cacheControl: IMMUTABLE_CACHE_CONTROL
    });
  });

  it("treats 404 as missing and propagates other errors", async () => {
    const store404 = new S3R2ObjectStore(
      {
        send: async () => {
          const error = new Error("missing") as Error & { $metadata: { httpStatusCode: number } };
          error.name = "NotFound";
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }
      } as never,
      "kidar-public-ar"
    );
    await expect(store404.head("missing.glb")).resolves.toBeNull();

    const store500 = new S3R2ObjectStore(
      {
        send: async () => {
          const error = new Error("boom") as Error & { $metadata: { httpStatusCode: number } };
          error.$metadata = { httpStatusCode: 500 };
          throw error;
        }
      } as never,
      "kidar-public-ar"
    );
    await expect(store500.head("x.glb")).rejects.toThrow(/boom/);
  });
});
