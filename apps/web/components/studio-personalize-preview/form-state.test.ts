import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COPY,
  FIXTURE_WORLD,
  PERSONALIZE_BACK_HREF,
  PERSONALIZE_CAMERA_HREF
} from "./fixtures";
import {
  createInitialPersonalizeState,
  FORBIDDEN_COPY_SNIPPETS,
  isPersonalizeWriteBlocked,
  setAtmosphere,
  setCharacter,
  setEffect,
  setPosition,
  setScale,
  setShowInWorld,
  setSound,
  summarizePersonalize
} from "./form-state";

const root = join(__dirname);

function readLocal(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

describe("Studio Preview Go B — fixture + local state", () => {
  it("exposes only the documented fixture world (no projectId / sourceUrl)", () => {
    expect(FIXTURE_WORLD.title).toBe("Grădina de după ploaie");
    expect(FIXTURE_WORLD.status).toBe("Previzualizare");
    expect(FIXTURE_WORLD.mode).toBe("Popout");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("projectId");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("sourceUrl");
    expect(Object.keys(FIXTURE_WORLD)).not.toContain("owner");
  });

  it("starts with empty character/effect and showInWorld on", () => {
    const state = createInitialPersonalizeState();
    expect(state.character).toBe("none");
    expect(state.effect).toBe("none");
    expect(state.showInWorld).toBe(true);
    expect(summarizePersonalize(state)).toContain("Dimineață");
  });

  it("updates each control only in memory", () => {
    let state = createInitialPersonalizeState();
    state = setCharacter(state, "butterfly");
    state = setEffect(state, "stars");
    state = setAtmosphere(state, "sunset");
    state = setSound(state, "rain");
    state = setPosition(state, "top");
    state = setScale(state, "large");
    expect(state).toMatchObject({
      character: "butterfly",
      effect: "stars",
      atmosphere: "sunset",
      sound: "rain",
      position: "top",
      scale: "large"
    });
    expect(summarizePersonalize(state)).toBe("Fluture · Stele · Apus · Ploaie");
  });

  it("toggle turns decorative visibility off without other side effects", () => {
    let state = setCharacter(createInitialPersonalizeState(), "dragon");
    state = setShowInWorld(state, false);
    expect(state.showInWorld).toBe(false);
    expect(state.character).toBe("dragon");
  });

  it("blocks every /api path and keeps CTAs on preview routes", () => {
    expect(isPersonalizeWriteBlocked("/api/projects")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/projects/x")).toBe(true);
    expect(isPersonalizeWriteBlocked("/api/publish")).toBe(true);
    expect(PERSONALIZE_BACK_HREF).toBe("/studio-preview");
    expect(PERSONALIZE_CAMERA_HREF).toBe("/studio-preview/personalizeaza/camera");
  });

  it("shell sources have no fetch, storage, or save/publish copy", () => {
    const shell = readLocal("personalize-shell.tsx");
    const poster = readLocal("garden-poster.tsx");
    const fixtures = readLocal("fixtures.ts");
    const impl = `${shell}\n${poster}`;

    expect(impl).not.toMatch(/\bfetch\s*\(/);
    expect(impl).not.toMatch(/XMLHttpRequest|WebSocket/);
    expect(impl).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
    expect(impl).not.toMatch(/\bnavigator\.mediaDevices\b|\.getUserMedia\b/);
    expect(impl).not.toMatch(/\bFormData\b|\bFileReader\b/);
    expect(impl).not.toMatch(/ProjectRecord|StudioWorldCard|sourceUrl|projectId/);
    for (const snippet of FORBIDDEN_COPY_SNIPPETS) {
      expect(impl.includes(snippet)).toBe(false);
      expect(fixtures.includes(snippet)).toBe(false);
    }
    expect(fixtures).toContain(COPY.title);
    expect(fixtures).toContain(COPY.previewNote);
    expect(fixtures).toContain(COPY.ctaCamera);
    expect(shell).toContain("PERSONALIZE_BACK_HREF");
    expect(shell).toContain("PERSONALIZE_CAMERA_HREF");
  });

  it("camera CTA points at the AR preview route", () => {
    expect(PERSONALIZE_CAMERA_HREF).toBe("/studio-preview/personalizeaza/camera");
    const shell = readLocal("personalize-shell.tsx");
    expect(shell).toContain("PERSONALIZE_CAMERA_HREF");
  });
});
