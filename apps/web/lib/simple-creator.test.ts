import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import {
  CREATOR_PRESETS,
  SOURCE_MAX_BYTES,
  experiencePatch,
  friendlyFigureName,
  friendlySurpriseName,
  gallerySearchPath,
  isPublishPath,
  isSimpleCreatorPreset,
  modeForExperienceChoice,
  projectPatchPath,
  showsMissionMessage,
  sourceUploadPath,
  technicalModeForPreset,
  validateSourceImage
} from "./simple-creator";

describe("friendlySurpriseName", () => {
  it("uses locale month names for the provided date, not a hardcoded calendar string", () => {
    const march = friendlySurpriseName(new Date(2026, 2, 5), "ro-RO");
    const november = friendlySurpriseName(new Date(2026, 10, 1), "ro-RO");
    expect(march).toMatch(/^Surpriza din /);
    expect(march).toContain("5");
    expect(march.toLowerCase()).toContain("martie");
    expect(november).toContain("1");
    expect(november.toLowerCase()).toContain("noiembrie");
    expect(march).not.toBe(november);
    expect(march).not.toBe("Surpriza din 18 septembrie");
  });
});

describe("preset mapping", () => {
  it("keeps the technical pipeline on popout for every Simple Creator preset", () => {
    for (const preset of CREATOR_PRESETS) {
      expect(technicalModeForPreset(preset)).toBe("popout");
      expect(isSimpleCreatorPreset(preset)).toBe(true);
    }
    expect(isSimpleCreatorPreset("studio")).toBe(false);
    expect(isSimpleCreatorPreset("popout")).toBe(false);
  });
});

describe("source image validation", () => {
  it("allows jpeg and png under 10 MB", () => {
    expect(validateSourceImage({ type: "image/jpeg", size: 1200, name: "page.jpg" })).toEqual({
      ok: true,
      small: true
    });
    expect(validateSourceImage({ type: "image/png", size: 80_000, name: "page.png" })).toEqual({
      ok: true,
      small: false
    });
    expect(validateSourceImage({ type: "", size: 80_000, name: "page.JPG" }).ok).toBe(true);
  });

  it("rejects invalid types and files over 10 MB", () => {
    expect(validateSourceImage({ type: "image/gif", size: 1000, name: "page.gif" })).toEqual({
      ok: false,
      code: "type",
      small: false
    });
    expect(validateSourceImage({ type: "application/pdf", size: 1000, name: "page.pdf" }).ok).toBe(
      false
    );
    expect(
      validateSourceImage({ type: "image/jpeg", size: SOURCE_MAX_BYTES + 1, name: "page.jpg" })
    ).toEqual({ ok: false, code: "size", small: false });
  });
});

describe("experience choice mapping", () => {
  it("maps friendly choices to existing project mode without changing preset", () => {
    expect(modeForExperienceChoice("popout")).toBe("popout");
    expect(modeForExperienceChoice("gallery")).toBe("gallery");
    const coloring = experiencePatch({ choice: "gallery", preset: "coloring" });
    expect(coloring.mode).toBe("gallery");
    expect(coloring.settings.preset).toBe("coloring");
    expect(coloring.settings.ctaText).toBeUndefined();
    const story = experiencePatch({ choice: "popout", preset: "story" });
    expect(story.mode).toBe("popout");
    expect(story.settings.preset).toBe("story");
  });

  it("shows the mission field only for mission and stores ctaText", () => {
    expect(showsMissionMessage("mission")).toBe(true);
    expect(showsMissionMessage("coloring")).toBe(false);
    expect(showsMissionMessage("story")).toBe(false);
    const patch = experiencePatch({
      choice: "popout",
      preset: "mission",
      ctaText: "  Caută cheia roșie lângă hartă.  "
    });
    expect(patch.settings.preset).toBe("mission");
    expect(patch.settings.ctaText).toBe("Caută cheia roșie lângă hartă.");
    expect(patch.mode).toBe("popout");
  });

  it("hides vendor names from figure labels", () => {
    expect(friendlyFigureName("Poly Pizza model")).toBe("Figurină");
    expect(friendlyFigureName("Dragon")).toBe("Dragon");
  });
});

describe("Simple Creator does not publish", () => {
  it("only targets private source and project patch paths", () => {
    expect(sourceUploadPath("abc")).toBe("/api/projects/abc/source");
    expect(projectPatchPath("abc")).toBe("/api/projects/abc");
    expect(gallerySearchPath("dragon")).toBe("/api/gallery?query=dragon");
    expect(isPublishPath("/api/projects/abc/source")).toBe(false);
    expect(isPublishPath("/api/projects/abc")).toBe(false);
    expect(isPublishPath("/api/gallery?query=dragon")).toBe(false);
    expect(isPublishPath("/api/publish")).toBe(true);
  });
});

describe("Simple Creator contrast tokens", () => {
  it("meets AA for ink, accent, and danger on paper", () => {
    expect(contrastRatio("#1B1726", "#F7F4EE")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FFFFFF", "#5B4FE0")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#9B1C2C", "#F7F4EE")).toBeGreaterThanOrEqual(4.5);
  });
});
