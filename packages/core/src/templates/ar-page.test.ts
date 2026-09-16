import { describe, expect, it } from "vitest";
import {
  AR_START_BUTTON_LABEL_RO,
  ArPageConfigError,
  MINDAR_AFRAME_SCRIPT_URL,
  buildArPageCsp,
  normalizeArPageConfig,
  renderArPage,
  type ArPageConfig
} from "./ar-page";

const baseConfig = (): ArPageConfig => ({
  title: "Desenul meu",
  theme: "#6d5dfc",
  modelUrl: "https://cdn.example.com/models/p1/abc/popout.glb",
  targetUrl: "https://cdn.example.com/targets/p1/abc/targets.mind",
  transform: {
    position: { x: 0.1, y: -0.2, z: 0 },
    rotation: { x: 0, y: 45, z: 0 },
    scale: 1.5
  }
});

describe("renderArPage", () => {
  it("renders deterministic HTML for a normalized config", () => {
    const htmlA = renderArPage(baseConfig());
    const htmlB = renderArPage(baseConfig());
    expect(htmlA).toBe(htmlB);
    expect(htmlA.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(htmlA).toContain('lang="ro"');
  });

  it("embeds model and .mind URLs plus MindAR aframe bundle", () => {
    const html = renderArPage(baseConfig());
    expect(html).toContain("https://cdn.example.com/models/p1/abc/popout.glb");
    expect(html).toContain("https://cdn.example.com/targets/p1/abc/targets.mind");
    expect(html).toContain(MINDAR_AFRAME_SCRIPT_URL);
    expect(html).toContain("a-gltf-model");
    expect(html).toContain('position="0.1 -0.2 0"');
    expect(html).toContain('rotation="0 45 0"');
    expect(html).toContain('scale="1.5 1.5 1.5"');
  });

  it("includes Romanian Start UI and autoStart false", () => {
    const html = renderArPage(baseConfig());
    expect(html).toContain(AR_START_BUTTON_LABEL_RO);
    expect(html).toContain('id="kidar-start"');
    expect(html).toContain("autoStart: false");
  });

  it("does not call getUserMedia or arSystem.start before Start handler", () => {
    const html = renderArPage(baseConfig());
    expect(html).not.toMatch(/getUserMedia/);
    const startIdx = html.indexOf("function startExperience");
    const startCallIdx = html.indexOf("arSystem.start()");
    expect(startIdx).toBeGreaterThan(-1);
    expect(startCallIdx).toBeGreaterThan(startIdx);
    // No eager start outside the Start click path
    expect(html).not.toMatch(/arSystem\.start\(\)\s*;\s*\n\s*\}\)\s*\(\)/);
    expect(html).toContain('startBtn.addEventListener("click", startExperience)');
  });

  it("ties audio playback to targetFound, not page load or Start alone", () => {
    const html = renderArPage({
      ...baseConfig(),
      audioUrl: "https://cdn.example.com/audio/whoosh.mp3"
    });
    expect(html).toContain("targetFound");
    expect(html).toContain("targetLost");
    expect(html).toContain("onTargetFound");
    expect(html).toContain('addEventListener("targetFound", onTargetFound)');
    expect(html).toContain("audio.play()");
    // Audio constructed with preload none; play only in onTargetFound
    expect(html).toContain('audio.preload = "none"');
    expect(html).not.toMatch(/autoplay/i);
    const playIdx = html.indexOf("audio.play()");
    const foundIdx = html.indexOf("function onTargetFound");
    const startIdx = html.indexOf("function startExperience");
    expect(playIdx).toBeGreaterThan(foundIdx);
    expect(html.slice(startIdx, startIdx + 400)).not.toContain("audio.play()");
  });

  it("escapes CTA/logo/title and rejects dangerous schemes", () => {
    const html = renderArPage({
      ...baseConfig(),
      title: `Test <script>alert(1)</script> & "x"`,
      logoUrl: "https://cdn.example.com/logo.png",
      ctaText: `Click <img onerror=alert(1)>`,
      ctaUrl: "https://cdn.example.com/cta?q=1&b=2"
    });
    expect(html).toContain("Test &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;");
    expect(html).toContain("Click &lt;img onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('href="https://cdn.example.com/cta?q=1&amp;b=2"');

    expect(() =>
      renderArPage({
        ...baseConfig(),
        modelUrl: "javascript:alert(1)"
      })
    ).toThrow(ArPageConfigError);

    expect(() =>
      renderArPage({
        ...baseConfig(),
        audioUrl: "data:audio/mp3;base64,aaa"
      })
    ).toThrow(/unsupported scheme|https/i);
  });

  it("rejects malformed URLs, credentials, and private/signed patterns", () => {
    expect(() => renderArPage({ ...baseConfig(), modelUrl: "not-a-url" })).toThrow(
      /valid absolute URL/i
    );
    expect(() =>
      renderArPage({
        ...baseConfig(),
        modelUrl: "https://user:pass@cdn.example.com/model.glb"
      })
    ).toThrow(/credentials/i);
    expect(() =>
      renderArPage({
        ...baseConfig(),
        modelUrl:
          "https://cdn.example.com/model.glb?X-Amz-Signature=abc&X-Amz-Credential=x"
      })
    ).toThrow(/private or signed/i);
    expect(() =>
      renderArPage({
        ...baseConfig(),
        targetUrl: "https://cdn.example.com/api/files/abc/view"
      })
    ).toThrow(/private or signed|\.mind/i);
    expect(() =>
      renderArPage({
        ...baseConfig(),
        targetUrl:
          "https://cloud.appwrite.io/v1/storage/buckets/x/files/y/download?project=z"
      })
    ).toThrow(/private or signed/i);
  });

  it("allows controlled local origins only when opted in", () => {
    expect(() =>
      renderArPage({
        ...baseConfig(),
        modelUrl: "http://127.0.0.1:4173/model.glb",
        targetUrl: "http://127.0.0.1:4173/targets.mind"
      })
    ).toThrow(/https/i);

    const html = renderArPage({
      ...baseConfig(),
      allowLocalOrigins: true,
      modelUrl: "http://127.0.0.1:4173/model.glb",
      targetUrl: "http://127.0.0.1:4173/targets.mind"
    });
    expect(html).toContain("http://127.0.0.1:4173/model.glb");
  });

  it("omits optional logo/CTA/audio/watermark safely when absent", () => {
    const html = renderArPage(baseConfig());
    expect(html).not.toContain('class="logo"');
    expect(html).not.toContain('class="cta"');
    expect(html).not.toContain("Creat cu kidAR Studio");
    expect(html).toContain("audioUrl = null");

    const withExtras = renderArPage({
      ...baseConfig(),
      showWatermark: true,
      logoUrl: "https://cdn.example.com/logo.png",
      ctaText: "Află mai mult",
      ctaUrl: "https://example.com/more"
    });
    expect(withExtras).toContain('class="logo"');
    expect(withExtras).toContain("Află mai mult");
    expect(withExtras).toContain("Creat cu kidAR Studio");
  });

  it("rejects invalid theme and incomplete CTA pairs", () => {
    expect(() => renderArPage({ ...baseConfig(), theme: "purple" })).toThrow(/#RRGGBB/i);
    expect(() =>
      renderArPage({ ...baseConfig(), ctaText: "Go", ctaUrl: undefined })
    ).toThrow(/together/i);
    expect(() => normalizeArPageConfig({ ...baseConfig(), theme: "#fff" })).toThrow(
      /#RRGGBB/i
    );
  });

  it("emits a parsed CSP with wasm compile permission and without unsafe-eval", () => {
    const html = renderArPage(baseConfig());
    const csp = extractCspMetaContent(html);
    const directives = parseCspDirectives(csp);

    const scriptSrc = directives.get("script-src") ?? [];
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).toContain("https://aframe.io");
    expect(scriptSrc).toContain("https://cdn.jsdelivr.net");
    expect(scriptSrc).toContain("https://cdn.example.com");

    const workerSrc = directives.get("worker-src") ?? [];
    expect(workerSrc).toContain("'self'");
    expect(workerSrc).toContain("blob:");

    const childSrc = directives.get("child-src") ?? [];
    expect(childSrc).toContain("blob:");

    const mediaSrc = directives.get("media-src") ?? [];
    expect(mediaSrc).toContain("blob:");

    const imgSrc = directives.get("img-src") ?? [];
    expect(imgSrc).toContain("blob:");
    expect(imgSrc).toContain("data:");

    const connectSrc = directives.get("connect-src") ?? [];
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain("https://cdn.example.com");
    expect(connectSrc).toContain("https://cdn.jsdelivr.net");

    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(scriptSrc).toEqual(expect.not.arrayContaining(["'unsafe-eval'"]));
    expect(csp).toBe(
      buildArPageCsp([
        "https://aframe.io",
        "https://cdn.example.com",
        "https://cdn.jsdelivr.net"
      ])
    );
  });
});

function extractCspMetaContent(html: string): string {
  const match = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/>/i
  );
  if (!match?.[1]) {
    throw new Error("CSP meta tag not found");
  }
  return match[1];
}

function parseCspDirectives(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const raw of csp.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const name = tokens[0];
    if (!name) continue;
    directives.set(name, tokens.slice(1));
  }
  return directives;
}
