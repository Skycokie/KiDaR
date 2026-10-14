import { describe, expect, it } from "vitest";
import { computeUnpublishInputHash } from "./hash";
import {
  collectCharacterVoiceAudioPaths,
  collectUnpublishKeys,
  isAllowedUnpublishKey,
  objectKeyFromPublicUrl,
  projectNeedsUnpublish
} from "./project-cleanup";

describe("project cleanup", () => {
  it("collects unique voice audio file ids", () => {
    expect(
      collectCharacterVoiceAudioPaths({
        primary: { role: "narrator", message: "hi", audioPath: "v_a" },
        other: { role: "hidden", message: "secret", audioPath: " v_a " },
        silent: { role: "narrator", message: "no audio" }
      })
    ).toEqual(["v_a"]);
    expect(collectCharacterVoiceAudioPaths(undefined)).toEqual([]);
  });

  it("maps public CDN URLs under our base to object keys", () => {
    expect(
      objectKeyFromPublicUrl(
        "https://ar.example.com",
        "https://ar.example.com/pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html"
      )
    ).toBe(
      "pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html"
    );
    expect(
      objectKeyFromPublicUrl("https://ar.example.com", "https://evil.example/pages/x")
    ).toBeNull();
  });

  it("always includes the experience pointer for a published slug", () => {
    const keys = collectUnpublishKeys({
      slug: "My-World",
      publicBaseUrl: "https://ar.example.com",
      publicHtmlUrl:
        "https://ar.example.com/pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html",
      publicQrUrl:
        "https://ar.example.com/pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/qr.png"
    });
    expect(keys).toContain("experiences/my-world/target.txt");
    expect(keys).toContain(
      "pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html"
    );
    expect(keys).toContain(
      "pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/qr.png"
    );
  });

  it("detects when a project still has a public experience", () => {
    expect(projectNeedsUnpublish({ slug: "a", publicExperienceUrl: "/ar/a" })).toBe(true);
    expect(projectNeedsUnpublish({ slug: "a", publicHtmlUrl: "https://x/y" })).toBe(true);
    expect(projectNeedsUnpublish({ slug: "a" })).toBe(false);
    expect(projectNeedsUnpublish({ publicHtmlUrl: "https://x/y" })).toBe(false);
  });

  it("hashes unpublish jobs by sorted keys", () => {
    const a = computeUnpublishInputHash(["b", "a"]);
    const b = computeUnpublishInputHash(["a", "b"]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("allow-lists only experience pointers and page artifacts", () => {
    expect(isAllowedUnpublishKey("experiences/demo/target.txt")).toBe(true);
    expect(
      isAllowedUnpublishKey(
        "pages/p1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html"
      )
    ).toBe(true);
    expect(isAllowedUnpublishKey("models/p1/hash/figurine.glb")).toBe(false);
    expect(isAllowedUnpublishKey("experiences/../evil/target.txt")).toBe(false);
  });
});
