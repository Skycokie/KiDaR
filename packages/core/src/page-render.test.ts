import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { generateArQrPng } from "./print/qr";
import { generateA4PrintPdf } from "./print/pdf";
import { renderArPage } from "./templates/ar-page";
import {
  arePageRenderDependenciesSatisfied,
  assertPublicHtmlBundle,
  cameraViewUrl,
  consumerArUrl,
  resolveCameraViewModel,
  experiencePointerKey,
  mapSettingsToArPageConfig,
  pageArtifactKey,
  selectClickableCta,
  pageRenderDependsOn,
  requiredJobsForMode,
  resolvePageRenderDependsOn
} from "./page-render";
import { AR_PAGE_TEMPLATE_VERSION } from "./templates/ar-page";
import { buildPageRenderInputDocument, computePageRenderInputHash, jobInputHashForType } from "./hash";
import { planPublishJobs, PublishPlanError } from "./publish-plan";
import type { ProjectSettings } from "./index";

const hash = "ab".repeat(32);
const settings = (): ProjectSettings => ({
  title: "Povestea mea",
  theme: "#5b4fe0",
  ctaText: "Caută cheia",
  ctaUrl: "https://example.com/info",
  scale: 1.25,
  offset: { x: 0.1, y: 0, z: -0.2 }
});

describe("page artifact keys", () => {
  it("builds deterministic immutable keys without timestamps", () => {
    expect(pageArtifactKey("proj_1", hash, "index.html")).toBe(
      `pages/proj_1/${hash}/index.html`
    );
    expect(pageArtifactKey("proj_1", hash, "qr.png")).toBe(`pages/proj_1/${hash}/qr.png`);
    expect(pageArtifactKey("proj_1", hash, "print.pdf")).toBe(
      `pages/proj_1/${hash}/print.pdf`
    );
    expect(experiencePointerKey("Surpriza din 19")).toBe("experiences/surpriza-din-19/target.txt");
    expect(pageArtifactKey("proj_1", hash, "index.html")).not.toMatch(/T\d{2}-/);
  });

  it("gives page_render a template-versioned hash without moving popout/mind keys", () => {
    const contentHash = "06af4e019aef756ae548bc31df01e26ef0b9742e2b35685b846f1b7453923f0c";
    const projectId = "6aafbb5c013ef8866554";
    const demoPage = {
      inputHash: contentHash,
      slug: "m44b-uv-demo",
      publicAppOrigin: "https://kidar-studio.vercel.app",
      publicAssetOrigin: "https://pub-42bfa182b9b24ace84de3ad65e843510.r2.dev",
      showWatermark: true
    };
    const pageHash = computePageRenderInputHash(demoPage);
    expect(pageHash).toBe("PLACEHOLDER_HASH_TO_UPDATE");
    expect(pageHash).not.toBe("6a3ea58b44099d164a4111566b8f7e3ba2751cdbbbfdbc58083fcca696ad59f9");
    expect(pageHash).not.toBe("0fc0b3dce1b01a98de8b5b3aad8e437d4654a808f3384ccc38dbb28377987bc0");
    expect(pageHash).not.toBe("d1b101633d92b0d0c10ae0694558baa24826d5facaa7ce799d9ebf3ad4e8dcff");
    expect(pageHash).not.toBe("3527ccad4accbcff68fd2b70156903ecc305039c26ad1c8ec93bfe83e8bedeb0");
    expect(pageHash).not.toBe("3b2af8d0cb4cb106d65bff31b92eba6a03d8cab08da7e3ed552affe84487acc2");
    expect(pageHash).not.toBe("6fc29bcdf0bac65c8f55317b155264c695364760562573edb45339747de9d8bc");
    expect(pageHash).not.toBe("da985e5f064af51b2eb2c76ee7cc2ce5f66e74f55aa497855c0cee1561122fe3");
    expect(pageHash).not.toBe("d867c9ccb235b01c93cb9597a9c3a08ab6d1f247b9cf32b7f0271b1278b1b805");
    expect(pageHash).not.toBe("1ed4281f282571306f3223e39b96a384613bb91cc074107d00bd55fc7a27b515");
    expect(pageHash).not.toBe("702ec36c95ea37a88a74f51574c86d6ec8a5589d5c575d3bd5ffde62fd3811fb");
    expect(pageHash).not.toBe(contentHash);
    expect(jobInputHashForType("popout_build", contentHash)).toBe(contentHash);
    expect(jobInputHashForType("mind_compile", contentHash)).toBe(contentHash);
    expect(jobInputHashForType("page_render", contentHash, demoPage)).toBe(pageHash);
    expect(pageArtifactKey(projectId, pageHash, "index.html")).not.toBe(
      pageArtifactKey(projectId, contentHash, "index.html")
    );
    expect(
      computePageRenderInputHash({
        ...demoPage,
        templateVersion: "ar-page-debug-v1"
      })
    ).not.toBe(pageHash);
    expect(
      computePageRenderInputHash({
        ...demoPage,
        publicAppOrigin: "https://example.com"
      })
    ).not.toBe(pageHash);
    expect(
      computePageRenderInputHash({
        ...demoPage,
        slug: "other-slug"
      })
    ).not.toBe(pageHash);
    expect(
      computePageRenderInputHash({
        ...demoPage,
        arAnchorMode: "follow"
      })
    ).not.toBe(pageHash);
    expect(buildPageRenderInputDocument(demoPage).arPageTemplateVersion).toBe(
      AR_PAGE_TEMPLATE_VERSION
    );
    expect(buildPageRenderInputDocument(demoPage).arAnchorMode).toBe("marker");
    expect(buildPageRenderInputDocument(demoPage).publicAppOrigin).toBe(
      "https://kidar-studio.vercel.app"
    );
    expect(buildPageRenderInputDocument({ inputHash: contentHash })).not.toHaveProperty(
      "createdAt"
    );
  });
});

describe("publish job orchestration", () => {
  it("queues popout_build only for pop-out mode", () => {
    const popout = planPublishJobs(
      { mode: "popout", sourceImagePath: "src_1", slug: "demo" },
      hash
    );
    expect(popout.jobs).toEqual(["popout_build", "mind_compile", "page_render"]);
    expect(popout.dependsOn).toEqual({ popout_build: hash, mind_compile: hash });
    expect(popout.publicModelUrl).toBeNull();

    const gallery = planPublishJobs(
      {
        mode: "gallery",
        sourceImagePath: "src_1",
        slug: "demo",
        galleryModelUrl: "https://cdn.example.com/dragon.glb"
      },
      hash
    );
    expect(gallery.jobs).toEqual(["mind_compile", "page_render"]);
    expect(gallery.dependsOn).toEqual({ mind_compile: hash });
    expect(gallery.publicModelUrl).toBe("https://cdn.example.com/dragon.glb");
  });

  it("fails closed without a source drawing or with a private gallery URL", () => {
    expect(() =>
      planPublishJobs({ mode: "popout", sourceImagePath: null, slug: "demo" }, hash)
    ).toThrow(PublishPlanError);
    expect(() =>
      planPublishJobs(
        {
          mode: "gallery",
          sourceImagePath: "src_1",
          slug: "demo",
          galleryModelUrl: "/api/files/source-drawings/src_1"
        },
        hash
      )
    ).toThrow(/absolute|public/i);
  });

  it("blocks page_render until upstream jobs are done", () => {
    const dependsOn = pageRenderDependsOn("popout", hash);
    expect(
      arePageRenderDependenciesSatisfied(dependsOn, [
        { type: "popout_build", status: "done", inputHash: hash, result: { publicUrl: "https://cdn.example.com/a.glb" } },
        { type: "mind_compile", status: "queued", inputHash: hash, result: null }
      ])
    ).toBe(false);
    expect(
      arePageRenderDependenciesSatisfied(dependsOn, [
        { type: "popout_build", status: "done", inputHash: hash, result: { publicUrl: "https://cdn.example.com/a.glb" } },
        { type: "mind_compile", status: "done", inputHash: hash, result: { publicUrl: "https://cdn.example.com/a.mind" } }
      ])
    ).toBe(true);
    expect(requiredJobsForMode("gallery")).not.toContain("popout_build");
  });

  it("resolves page_render upstream hashes from payload, not the template hash", () => {
    const contentHash = hash;
    const pageHash = computePageRenderInputHash({ inputHash: contentHash });
    const dependsOn = pageRenderDependsOn("popout", contentHash);
    expect(
      resolvePageRenderDependsOn("popout", { inputHash: pageHash, dependsOn })
    ).toEqual(dependsOn);
    expect(() =>
      resolvePageRenderDependsOn("popout", { inputHash: pageHash })
    ).toThrow(/dependsOn\.mind_compile|refusing page_render inputHash/i);
    try {
      resolvePageRenderDependsOn("popout", { inputHash: pageHash, dependsOn: null });
      throw new Error("expected MISSING_DEPENDS_ON");
    } catch (error) {
      expect(error).toMatchObject({ code: "MISSING_DEPENDS_ON", retryable: false });
    }
  });
});

describe("settings to AR page mapping", () => {
  it("maps project settings into renderArPage and keeps only public URLs", () => {
    const modelUrl = "https://cdn.example.com/models/p/abc/popout.glb";
    const targetUrl = "https://cdn.example.com/targets/p/abc/targets.mind";
    const mapped = mapSettingsToArPageConfig({
      settings: settings(),
      modelUrl,
      targetUrl,
      allowLocalOrigins: false
    });
    expect(mapped.title).toBe("Povestea mea");
    expect(mapped.theme).toBe("#5b4fe0");
    expect(mapped.ctaText).toBe("Caută cheia");
    expect(mapped.scale).toBe(1.25);
    const html = renderArPage({
      title: mapped.title,
      theme: mapped.theme,
      modelUrl: mapped.modelUrl,
      targetUrl: mapped.targetUrl,
      ctaText: mapped.ctaText ?? undefined,
      ctaUrl: mapped.ctaUrl ?? undefined,
      transform: { position: mapped.position, scale: mapped.scale }
    });
    expect(html).toContain(modelUrl);
    expect(html).toContain(targetUrl);
    expect(() => assertPublicHtmlBundle(html, { modelUrl, targetUrl })).not.toThrow();
    expect(html.toLowerCase()).not.toMatch(/\/api\/files\/|source-drawings|x-amz-signature/);
  });

  it("omits incomplete CTA so Mission ctaText without ctaUrl can publish", () => {
    expect(selectClickableCta({ ctaText: "Caută cheia" })).toEqual({});
    expect(selectClickableCta({ ctaUrl: "https://example.com/info" })).toEqual({});
    expect(selectClickableCta({ ctaText: "  ", ctaUrl: "https://example.com/info" })).toEqual({});
    const modelUrl = "https://cdn.example.com/models/p/abc/popout.glb";
    const targetUrl = "https://cdn.example.com/targets/p/abc/targets.mind";
    const mapped = mapSettingsToArPageConfig({
      settings: { ...settings(), ctaText: "Caută cheia", ctaUrl: undefined },
      modelUrl,
      targetUrl
    });
    expect(mapped.ctaText).toBeNull();
    expect(mapped.ctaUrl).toBeNull();
    const html = renderArPage({
      title: mapped.title,
      theme: mapped.theme,
      modelUrl: mapped.modelUrl,
      targetUrl: mapped.targetUrl,
      ctaText: mapped.ctaText ?? undefined,
      ctaUrl: mapped.ctaUrl ?? undefined
    });
    expect(html).not.toContain('class="cta"');
    expect(html).not.toContain("Caută cheia");
  });

  it("omits CTA when only the URL is set", () => {
    const mapped = mapSettingsToArPageConfig({
      settings: { ...settings(), ctaText: undefined, ctaUrl: "https://example.com/info" },
      modelUrl: "https://cdn.example.com/models/p/abc/popout.glb",
      targetUrl: "https://cdn.example.com/targets/p/abc/targets.mind"
    });
    expect(mapped.ctaText).toBeNull();
    expect(mapped.ctaUrl).toBeNull();
  });

  it("refuses private, signed, or non-https CTA URLs instead of omitting them", () => {
    const base = {
      settings: settings(),
      modelUrl: "https://cdn.example.com/models/p/abc/popout.glb",
      targetUrl: "https://cdn.example.com/targets/p/abc/targets.mind"
    };
    expect(() =>
      mapSettingsToArPageConfig({
        ...base,
        settings: { ...settings(), ctaUrl: "javascript:alert(1)" }
      })
    ).toThrow(/unsupported scheme|https/i);
    expect(() =>
      mapSettingsToArPageConfig({
        ...base,
        settings: { ...settings(), ctaUrl: "data:text/html,hi" }
      })
    ).toThrow(/unsupported scheme|https/i);
    expect(() =>
      mapSettingsToArPageConfig({
        ...base,
        settings: { ...settings(), ctaUrl: "https://kidar.example/api/files/source-drawings/src_1" }
      })
    ).toThrow(/private or signed/i);
    expect(() =>
      mapSettingsToArPageConfig({
        ...base,
        settings: {
          ...settings(),
          ctaUrl: "https://cdn.example.com/cta?X-Amz-Signature=deadbeef"
        }
      })
    ).toThrow(/private or signed/i);
  });

  it("maps scene.arAnchorMode follow into the AR page config", () => {
    const modelUrl = "https://cdn.example.com/models/p/abc/popout.glb";
    const targetUrl = "https://cdn.example.com/targets/p/abc/targets.mind";
    const marker = mapSettingsToArPageConfig({
      settings: settings(),
      modelUrl,
      targetUrl
    });
    expect(marker.arAnchorMode).toBe("marker");

    const follow = mapSettingsToArPageConfig({
      settings: { ...settings(), scene: { arAnchorMode: "follow" } },
      modelUrl,
      targetUrl
    });
    expect(follow.arAnchorMode).toBe("follow");
    // renderArPage takes the unnormalized shape, so rebuild it rather than
    // feeding the normalized config back in.
    expect(
      renderArPage({
        title: follow.title,
        theme: follow.theme,
        modelUrl: follow.modelUrl,
        targetUrl: follow.targetUrl,
        arAnchorMode: follow.arAnchorMode
      })
    ).toContain('data-ar-anchor="follow"');
  });

  it("maps persisted scene.decor into marker-anchored props on the app origin", () => {
    const mapped = mapSettingsToArPageConfig({
      settings: {
        ...settings(),
        scene: { decor: [{ id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 }] }
      },
      modelUrl: "https://cdn.example.com/models/p/abc/popout.glb",
      targetUrl: "https://cdn.example.com/targets/p/abc/targets.mind",
      publicAppOrigin: "https://kidar.example"
    });
    expect(mapped.props).toHaveLength(1);
    expect(mapped.props[0].modelUrl).toBe("https://kidar.example/demo/glb/decor/tree.glb");
    expect(mapped.props[0].position.x).toBeCloseTo(0.2);
    expect(mapped.props[0].position.y).toBeCloseTo(0.1);
  });

  it("changes the page_render hash when decor placement changes", () => {
    const base = {
      inputHash: hash,
      slug: "demo",
      publicAppOrigin: "https://kidar.example",
      publicAssetOrigin: "https://cdn.example.com",
      showWatermark: true
    };
    const without = computePageRenderInputHash(base);
    const withDecor = computePageRenderInputHash({
      ...base,
      decor: [{ id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 }]
    });
    const moved = computePageRenderInputHash({
      ...base,
      decor: [{ id: "tree", x: 20, y: 40, yaw: 90, pitch: 0 }]
    });
    expect(withDecor).not.toBe(without);
    expect(moved).not.toBe(withDecor);
  });
});

describe("camera view (character-only)", () => {
  const model = "https://cdn.example.com/models/p1/abc/popout.glb";

  it("builds an app URL under /ar/{slug}/camera that carries only the character GLB", () => {
    const url = cameraViewUrl("https://kidar.example", "Demo Slug", model);
    expect(url).toBe(
      `https://kidar.example/ar/demo-slug/camera?model=${encodeURIComponent(model)}`
    );
  });

  it("accepts only GLBs on the public artifact origin", () => {
    const base = "https://cdn.example.com";
    expect(resolveCameraViewModel({ modelParam: model, publicBaseUrl: base })).toEqual({
      ok: true,
      modelUrl: model
    });
    expect(resolveCameraViewModel({ modelParam: null, publicBaseUrl: base })).toEqual({
      ok: false,
      reason: "missing"
    });
    expect(
      resolveCameraViewModel({ modelParam: "https://evil.example/x.glb", publicBaseUrl: base })
    ).toEqual({ ok: false, reason: "foreign_origin" });
    expect(
      resolveCameraViewModel({
        modelParam: "https://cdn.example.com/pages/p1/abc/index.html",
        publicBaseUrl: base
      })
    ).toEqual({ ok: false, reason: "not_glb" });
    expect(resolveCameraViewModel({ modelParam: "javascript:1", publicBaseUrl: base })).toEqual({
      ok: false,
      reason: "invalid"
    });
    expect(resolveCameraViewModel({ modelParam: model, publicBaseUrl: undefined })).toEqual({
      ok: false,
      reason: "invalid"
    });
  });
});

describe("QR and PDF inputs", () => {
  it("encodes the public /ar/{slug} URL and feeds PDF private image bytes plus QR PNG", async () => {
    const experience = consumerArUrl("https://kidar.example", "demo-slug");
    expect(experience).toBe("https://kidar.example/ar/demo-slug");
    const qr = await generateArQrPng(experience, { size: 192 });
    const qrPng = PNG.sync.read(Buffer.from(qr));
    const code = jsQR(new Uint8ClampedArray(qrPng.data), qrPng.width, qrPng.height);
    expect(code?.data).toBe(experience);

    const sourceDoc = new PNG({ width: 32, height: 24 });
    sourceDoc.data.fill(200);
    const source = new Uint8Array(PNG.sync.write(sourceDoc));
    const pdf = await generateA4PrintPdf({
      sourceImageBytes: source,
      sourceMimeType: "image/png",
      qrPngBytes: qr,
      instructionLine: "Scaneaza codul QR"
    });
    expect(pdf.byteLength).toBeGreaterThan(100);
    const asText = Buffer.from(pdf).toString("latin1");
    expect(asText).not.toContain("https://");
    expect(asText).not.toContain("/api/files/");
  });
});

describe("public experience redirect mapping", () => {
  it("resolves a slug from a public pointer without Appwrite URLs", async () => {
    const { resolveExperienceRedirect } = await import("./experience-route");
    const htmlUrl = "https://cdn.example.com/pages/p1/abc/index.html";
    const result = await resolveExperienceRedirect({
      slug: "demo-slug",
      publicBaseUrl: "https://cdn.example.com",
      fetchImpl: async (url) => {
        expect(String(url)).toBe("https://cdn.example.com/experiences/demo-slug/target.txt");
        expect(String(url)).not.toMatch(/appwrite|\/api\//);
        return new Response(htmlUrl, { status: 200 });
      }
    });
    expect(result).toEqual({ ok: true, url: htmlUrl });
  });

  it("returns 404 when the pointer is missing", async () => {
    const { resolveExperienceRedirect } = await import("./experience-route");
    const result = await resolveExperienceRedirect({
      slug: "missing",
      publicBaseUrl: "https://cdn.example.com",
      fetchImpl: async () => new Response("nope", { status: 404 })
    });
    expect(result).toEqual({ ok: false, status: 404 });
  });
});
