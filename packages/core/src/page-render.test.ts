import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { generateArQrPng } from "./print/qr";
import { generateA4PrintPdf } from "./print/pdf";
import { renderArPage } from "./templates/ar-page";
import {
  arePageRenderDependenciesSatisfied,
  assertPublicHtmlBundle,
  consumerArUrl,
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
    const pageHash = computePageRenderInputHash({ inputHash: contentHash });
    expect(pageHash).toBe("35064c223ec7f728c034e5140f0c76df6a61b96de41181edb78af985626df601");
    expect(pageHash).not.toBe(contentHash);
    expect(jobInputHashForType("popout_build", contentHash)).toBe(contentHash);
    expect(jobInputHashForType("mind_compile", contentHash)).toBe(contentHash);
    expect(jobInputHashForType("page_render", contentHash)).toBe(pageHash);
    expect(pageArtifactKey(projectId, pageHash, "index.html")).not.toBe(
      pageArtifactKey(projectId, contentHash, "index.html")
    );
    expect(
      computePageRenderInputHash({
        inputHash: contentHash,
        templateVersion: "ar-page-debug-v1"
      })
    ).not.toBe(pageHash);
    expect(buildPageRenderInputDocument({ inputHash: contentHash }).arPageTemplateVersion).toBe(
      AR_PAGE_TEMPLATE_VERSION
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
    expect(resolvePageRenderDependsOn("popout", { inputHash: contentHash })).toEqual(dependsOn);
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
