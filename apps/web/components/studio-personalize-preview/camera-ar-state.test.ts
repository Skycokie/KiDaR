import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMERA_AR_COPY, CAMERA_AR_STUDIO_HREF } from "./camera-ar-fixtures";
import {
  cameraArStatusMessage,
  continueFromPreparing,
  createInitialCameraArState,
  markFound,
  markLost,
  retrySearch,
  showIncompatible,
  showUnavailable,
  showsWorldOverlay,
  startPreview,
  worldOverlayDimmed
} from "./camera-ar-state";

const root = join(__dirname);

function readLocal(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

describe("Cameră AR Preview Go B — state machine", () => {
  it("starts on intro with honest badge copy available", () => {
    const state = createInitialCameraArState();
    expect(state.phase).toBe("intro");
    expect(CAMERA_AR_COPY.badge).toContain("camera nu pornește încă");
    expect(CAMERA_AR_COPY.introTitle).toBe(
      "Privește poza prin cameră. Observă cum prinde viață."
    );
    expect(CAMERA_AR_COPY.tryPreview).toBe("Încearcă previzualizarea");
  });

  it("transitions Intro → Pregătire → Caută poza via buttons only", () => {
    let state = createInitialCameraArState();
    state = startPreview(state);
    expect(state.phase).toBe("preparing");
    expect(cameraArStatusMessage(state.phase)).toBe("Pregătim privirea.");
    state = continueFromPreparing(state);
    expect(state.phase).toBe("searching");
    expect(cameraArStatusMessage(state.phase)).toBe("Caută poza în fața ta.");
  });

  it("found shows world overlay; lost dims and allows retry", () => {
    let state = continueFromPreparing(startPreview(createInitialCameraArState()));
    state = markFound(state);
    expect(state.phase).toBe("found");
    expect(showsWorldOverlay(state.phase)).toBe(true);
    expect(cameraArStatusMessage(state.phase)).toBe("Am găsit poza.");

    state = markLost(state);
    expect(state.phase).toBe("lost");
    expect(showsWorldOverlay(state.phase)).toBe(true);
    expect(worldOverlayDimmed(state.phase)).toBe(true);
    expect(cameraArStatusMessage(state.phase)).toBe("Nu mai văd poza.");
    expect(CAMERA_AR_COPY.showAgain).toBe("Arată-mi poza din nou");

    state = retrySearch(state);
    expect(state.phase).toBe("searching");
  });

  it("unavailable and incompatible show correct copy", () => {
    expect(cameraArStatusMessage(showUnavailable(createInitialCameraArState()).phase)).toBe(
      "Camera nu este disponibilă."
    );
    expect(cameraArStatusMessage(showIncompatible(createInitialCameraArState()).phase)).toBe(
      "Această previzualizare funcționează cel mai bine pe telefon."
    );
  });

  it("back link targets Studio personalize route", () => {
    expect(CAMERA_AR_STUDIO_HREF).toBe("/studio-preview/personalizeaza");
    const shell = readLocal("camera-ar-shell.tsx");
    expect(shell).toContain("CAMERA_AR_STUDIO_HREF");
    expect(shell).toContain("CAMERA_AR_COPY.backStudio");
  });

  it("implementation has no camera hardware, network, or storage APIs", () => {
    const impl = [
      readLocal("camera-ar-shell.tsx"),
      readLocal("camera-ar-scene.tsx"),
      readLocal("camera-ar-state.ts"),
      readLocal("camera-ar-fixtures.ts")
    ].join("\n");

    expect(impl).not.toMatch(/\bfetch\s*\(/);
    expect(impl).not.toMatch(/XMLHttpRequest|WebSocket/);
    expect(impl).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
    expect(impl).not.toMatch(/\bnavigator\.mediaDevices\b|\.getUserMedia\b/);
    expect(impl).not.toMatch(/<video\b|<canvas\b/i);
    expect(impl).not.toMatch(/ProjectRecord|StudioWorldCard|sourceUrl|projectId/);
    expect(impl).not.toMatch(/\bFormData\b|\bPermissions\b/);
    expect(impl).toContain('aria-live="polite"');
    expect(impl).toContain("camera-ar-go-b");
  });
});
