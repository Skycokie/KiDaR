import { describe, expect, it } from "vitest";
import {
  AR_FAILURE_COPY_RO,
  AR_RETRY_BUTTON_LABEL_RO,
  AR_START_BUTTON_LABEL_RO,
  ArPageConfigError,
  MINDAR_AFRAME_SCRIPT_URL,
  buildArPageCsp,
  classifyArStartError,
  createArStartGate,
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

  it("does not invoke getUserMedia or arSystem.start before the Start click handler", () => {
    const html = renderArPage(baseConfig());
    const startIdx = html.indexOf("function startExperience");
    const startCallIdx = html.indexOf("arSystem.start()");
    expect(startIdx).toBeGreaterThan(-1);
    expect(startCallIdx).toBeGreaterThan(startIdx);
    const startFn = extractFunction(html, "startExperience");
    expect(startFn).toContain("arSystem.start()");
    expect(startFn).not.toMatch(/\bawait\b/);
    expect(startFn).not.toMatch(/setTimeout\s*\(/);
    expect(startFn).not.toMatch(/Promise/);
    expect(html).toContain('startBtn.addEventListener("click", startExperience)');
    const bootStart = html.indexOf("(function ()");
    const clickIdx = html.indexOf('startBtn.addEventListener("click", startExperience)');
    const eagerSlice = html.slice(bootStart, startIdx);
    expect(eagerSlice).not.toContain("arSystem.start()");
    expect(html.slice(clickIdx)).not.toMatch(/getUserMedia\([^)]*\)\s*;/);
    expect(html).not.toContain("autoStart: true");
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
    expect(connectSrc).toContain("blob:");
    expect(connectSrc).toContain("https://cdn.example.com");
    expect(connectSrc).toContain("https://cdn.jsdelivr.net");

    expect(workerSrc).toContain("data:");
    expect(workerSrc).toContain("'wasm-unsafe-eval'");
    expect(childSrc).toContain("data:");
    expect(childSrc).toContain("'wasm-unsafe-eval'");

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

describe("AR start gate and error classification", () => {
  it("invokes start only from the Start click handler", () => {
    const html = renderArPage(baseConfig());
    expect(html).toContain('startBtn.addEventListener("click", startExperience)');
    expect(html.match(/arSystem\.start\(\)/g)).toEqual(["arSystem.start()"]);
    const startFn = extractFunction(html, "startExperience");
    expect(startFn).toContain("arSystem.start()");
    expect(startFn.indexOf("arSystem.start()")).toBeGreaterThan(startFn.indexOf("function startExperience") === -1 ? -1 : 0);
  });

  it("allows exactly one init attempt while starting and retry after failure", () => {
    const gate = createArStartGate();
    expect(gate.getState()).toBe("idle");
    expect(gate.tryBegin()).toBe(true);
    expect(gate.getState()).toBe("starting");
    expect(gate.tryBegin()).toBe(false);
    gate.setState("camera-requested");
    expect(gate.tryBegin()).toBe(false);
    gate.setState("mindar-loading");
    expect(gate.tryBegin()).toBe(false);
    gate.succeed();
    expect(gate.tryBegin()).toBe(false);
    gate.fail();
    expect(gate.getState()).toBe("failed");
    expect(gate.tryBegin()).toBe(true);
    expect(gate.getState()).toBe("starting");
  });

  it("keeps retry visible and enabled in generated markup after failure paths", () => {
    const html = renderArPage(baseConfig());
    expect(html).toContain(AR_RETRY_BUTTON_LABEL_RO);
    expect(html).toContain("restoreRetry");
    expect(html).toContain("startBtn.disabled = false");
    expect(html).toContain("startPanel.hidden = false");
    expect(html).toContain('id="kidar-start"');
    expect(html).not.toContain("started = true");
  });

  it("maps permission errors separately from MindAR/A-Frame/runtime/network errors", () => {
    expect(
      classifyArStartError({ name: "NotAllowedError", message: "Permission denied", gumRequested: true })
    ).toBe("permission");
    expect(
      classifyArStartError({ name: "NotReadableError", message: "Could not start video source" })
    ).toBe("camera-unavailable");
    expect(
      classifyArStartError({ name: "OverconstrainedError", message: "facingMode" })
    ).toBe("camera-unavailable");
    expect(
      classifyArStartError({
        mindarError: "VIDEO_FAIL",
        gumRequested: true,
        name: "",
        message: ""
      })
    ).toBe("ar-init");
    expect(
      classifyArStartError({
        name: "KidarArError",
        message: "mindar-image-system not ready"
      })
    ).toBe("ar-init");
    expect(
      classifyArStartError({
        name: "TypeError",
        message: "Failed to fetch",
        httpStatus: 404
      })
    ).toBe("asset-network");
    expect(
      classifyArStartError({
        mediaDevicesPresent: false,
        mindarError: "VIDEO_FAIL",
        gumRequested: false
      })
    ).toBe("unsupported");

    const html = renderArPage(baseConfig());
    expect(html).toContain(AR_FAILURE_COPY_RO.permission);
    expect(html).toContain(AR_FAILURE_COPY_RO["camera-unavailable"]);
    expect(html).toContain(AR_FAILURE_COPY_RO["ar-init"]);
    expect(html).toContain(AR_FAILURE_COPY_RO.unsupported);
    expect(html).toContain(AR_FAILURE_COPY_RO["asset-network"]);
    expect(html).not.toContain("Accesul la cameră a fost refuzat");
    const arErrorHandler = html.slice(html.indexOf('addEventListener("arError"'));
    expect(arErrorHandler).not.toContain(AR_FAILURE_COPY_RO.permission + ")");
    expect(html).toContain('return "ar-init"');
  });

  it("shows the debug panel only when debug=1 is present", () => {
    const html = renderArPage(baseConfig());
    expect(html).toContain('id="kidar-debug" hidden');
    expect(html).toContain("(?:^|[?&])debug=1(?:&|$)");
    expect(html).toContain("[kidar-ar]");
    expect(html).toContain("debugEnabled");
    const boot = html.slice(html.indexOf("(function ()"));
    expect(boot).toMatch(/if \(!debugEnabled \|\| !debugEl\) return/);
    expect(boot).toContain("debugEl.hidden = false");
    expect(html).not.toContain("APPWRITE");
    expect(html).not.toContain("token=");
  });

  it("does not claim iPhone camera success", () => {
    const html = renderArPage(baseConfig());
    expect(html.toLowerCase()).not.toMatch(/iphone camera success|camera works on ios/);
    expect(classifyArStartError({ mindarError: "VIDEO_FAIL" })).not.toBe("permission");
  });
});

function extractFunction(html: string, name: string): string {
  const start = html.indexOf(`function ${name}`);
  if (start < 0) {
    throw new Error(`function ${name} not found`);
  }
  let depth = 0;
  let started = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "{") {
      depth += 1;
      started = true;
    } else if (ch === "}") {
      depth -= 1;
      if (started && depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }
  throw new Error(`function ${name} not closed`);
}

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
