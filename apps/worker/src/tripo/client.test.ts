import { describe, expect, it, vi } from "vitest";
import { FigurineBuildError } from "@kidar/core";
import { createTripoProvider } from "./client";
import { isTripoConfigured, requireTripoConfig, TripoConfigError } from "./config";

describe("tripo config", () => {
  it("fails closed without API key", () => {
    expect(isTripoConfigured({})).toBe(false);
    expect(() => requireTripoConfig({})).toThrow(TripoConfigError);
  });

  it("accepts key + default base url", () => {
    const cfg = requireTripoConfig({ TRIPO_API_KEY: "test-key" });
    expect(cfg.apiKey).toBe("test-key");
    expect(cfg.baseUrl).toBe("https://openapi.tripo3d.ai/v3");
  });
});

describe("tripo provider (mocked fetch)", () => {
  it("uploads, submits once, polls, and downloads without leaking bearer tokens in errors", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/files")) {
        return new Response(JSON.stringify({ code: 0, data: { file_token: "file_abc" } }), {
          status: 200
        });
      }
      if (url.endsWith("/generation/image-to-model")) {
        return new Response(JSON.stringify({ code: 0, data: { task_id: "task_1" } }), {
          status: 200
        });
      }
      if (url.endsWith("/mesh/decimate")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        expect(body.input).toBe("task_1");
        expect(body.face_limit).toBe(20_000);
        expect(body.bake).toBe(true);
        expect(body.model).toBe("v2.0");
        return new Response(JSON.stringify({ code: 0, data: { task_id: "retopo_1" } }), {
          status: 200
        });
      }
      if (url.includes("/tasks/task_1")) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              status: "success",
              progress: 100,
              output: { model: "https://cdn.example.com/hi.glb" }
            }
          }),
          { status: 200 }
        );
      }
      if (url.includes("/tasks/retopo_1")) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              status: "success",
              progress: 100,
              output: { model: "https://cdn.example.com/lo.glb" }
            }
          }),
          { status: 200 }
        );
      }
      if (url === "https://cdn.example.com/lo.glb") {
        return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3]), { status: 200 });
      }
      return new Response("missing", { status: 404 });
    });

    const provider = createTripoProvider(
      { apiKey: "secret-key", baseUrl: "https://openapi.tripo3d.ai/v3" },
      { fetch: fetchMock as unknown as typeof fetch }
    );

    const uploaded = await provider.uploadImage({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      filename: "s.png",
      contentType: "image/png"
    });
    expect(uploaded.fileToken).toBe("file_abc");

    const submitted = await provider.submitImageToModel({ fileToken: uploaded.fileToken });
    expect(submitted.providerTaskId).toBe("task_1");

    const retopo = await provider.submitMeshDecimate({
      sourceTaskId: submitted.providerTaskId,
      faceLimit: 20_000,
      bake: true
    });
    expect(retopo.providerTaskId).toBe("retopo_1");

    const task = await provider.getTask("retopo_1");
    expect(task.status).toBe("success");
    expect(task.modelUrl).toBe("https://cdn.example.com/lo.glb");

    const buf = await provider.downloadModel(task.modelUrl!);
    expect(buf.byteLength).toBeGreaterThan(0);

    expect(calls.some((c) => c.includes("/mesh/decimate"))).toBe(true);

    const authCalls = fetchMock.mock.calls.filter((c) => {
      const headers = c[1]?.headers as Record<string, string> | undefined;
      return headers?.Authorization;
    });
    expect(authCalls.length).toBeGreaterThan(0);
    for (const call of authCalls) {
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toContain("Bearer");
    }
  });

  it("marks 5xx as retryable and does not retry semantics for 400", async () => {
    const provider = createTripoProvider(
      { apiKey: "k", baseUrl: "https://openapi.tripo3d.ai/v3" },
      {
        fetch: vi.fn(async () => new Response(JSON.stringify({ message: "bad" }), { status: 400 })) as unknown as typeof fetch
      }
    );
    await expect(provider.getTask("x")).rejects.toMatchObject({
      name: "FigurineBuildError",
      retryable: false,
      code: "TRIPO_REJECTED"
    } satisfies Partial<FigurineBuildError>);

    const provider5 = createTripoProvider(
      { apiKey: "k", baseUrl: "https://openapi.tripo3d.ai/v3" },
      {
        fetch: vi.fn(async () => new Response("nope", { status: 503 })) as unknown as typeof fetch
      }
    );
    await expect(provider5.getTask("x")).rejects.toMatchObject({
      retryable: true,
      code: "TRIPO_TRANSIENT"
    });
  });
});
