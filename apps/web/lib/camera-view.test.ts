import { describe, expect, it } from "vitest";
import { cameraViewPlatform, loadCameraView } from "@/lib/camera-view";

const env = {
  NEXT_PUBLIC_APP_URL: "https://kidar.example",
  R2_PUBLIC_BASE_URL: "https://cdn.example.com"
};
const model = "https://cdn.example.com/models/proj1/abc/popout.glb";
const published: typeof fetch = async (url) => {
  expect(String(url)).toBe("https://cdn.example.com/experiences/cocos/target.txt");
  return new Response("https://cdn.example.com/pages/proj1/abc/index.html", { status: 200 });
};

describe("loadCameraView", () => {
  it("hydrates a published world with the character GLB and a desktop QR", async () => {
    const state = await loadCameraView({ slug: "cocos", modelParam: model, env, fetchImpl: published });
    expect(state).toMatchObject({ kind: "ready", slug: "cocos", arPageHref: "/ar/cocos", modelUrl: model });
    if (state.kind !== "ready") throw new Error("expected ready");
    expect(state.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("is not public until the R2 pointer exists", async () => {
    const state = await loadCameraView({
      slug: "cocos",
      modelParam: model,
      env,
      fetchImpl: async () => new Response("missing", { status: 404 })
    });
    expect(state).toEqual({ kind: "not_public" });
  });

  it("falls back to the missing-asset state for absent, foreign, or non-GLB models", async () => {
    for (const modelParam of [
      undefined,
      "https://evil.example/x.glb",
      "https://cdn.example.com/pages/proj1/abc/index.html"
    ]) {
      const state = await loadCameraView({ slug: "cocos", modelParam, env, fetchImpl: published });
      expect(state).toMatchObject({ kind: "ready", modelUrl: null });
    }
  });

  it("keeps working without an app URL, just without the QR", async () => {
    const state = await loadCameraView({
      slug: "cocos",
      modelParam: model,
      env: { R2_PUBLIC_BASE_URL: env.R2_PUBLIC_BASE_URL },
      fetchImpl: published
    });
    expect(state).toMatchObject({ kind: "ready", modelUrl: model, qrDataUrl: null });
  });
});

describe("cameraViewPlatform", () => {
  it("routes iOS to Quick Look, Android to Scene Viewer, everything else to desktop", () => {
    expect(cameraViewPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe("ios");
    expect(cameraViewPlatform({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
    expect(cameraViewPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120" })).toBe("android");
    expect(cameraViewPlatform({ userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120" })).toBe("desktop");
    expect(cameraViewPlatform({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })).toBe("desktop");
  });
});
