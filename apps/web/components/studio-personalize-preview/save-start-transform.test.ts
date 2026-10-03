import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "@/i18n/get-messages";
import {
  buildStartTransformPatch,
  isStartPoseDirty,
  parseArAnchorMode,
  patchStartTransform,
  persistedDecorToStudio,
  startSavePresentation,
  type StudioDecorForSave
} from "./save-start-transform";
import { createWorkspaceState } from "./form-state";

describe("start transform preview save", () => {
  it("maps pitch/yaw onto model rotation and keeps persisted offset and scale", () => {
    const body = buildStartTransformPatch({
      yaw: -32,
      pitch: 8,
      offset: { x: 0.2, y: -0.1, z: 0.4 },
      scale: 1.4
    });
    expect(body).toEqual({
      settings: {
        scene: {
          arAnchorMode: "marker",
          startTransform: {
            rotation: { x: 8, y: -32, z: 180 },
            position: { x: 0.2, y: -0.1, z: 0.4 },
            scale: 1.4
          },
          decor: []
        }
      }
    });
    expect(JSON.stringify(body)).not.toContain("zoom");
    expect(Object.keys(body.settings)).toEqual(["scene"]);
  });

  it("persists follow and marker arAnchorMode with the start pose patch", () => {
    const follow = buildStartTransformPatch({
      yaw: 0,
      pitch: 0,
      offset: { x: 0, y: 0, z: 0 },
      scale: 1,
      arAnchorMode: "follow"
    });
    expect(follow.settings.scene.arAnchorMode).toBe("follow");
    const marker = buildStartTransformPatch({
      yaw: 0,
      pitch: 0,
      offset: { x: 0, y: 0, z: 0 },
      scale: 1,
      arAnchorMode: "marker"
    });
    expect(marker.settings.scene.arAnchorMode).toBe("marker");
  });

  it("parses invalid or missing arAnchorMode as marker", () => {
    expect(parseArAnchorMode("follow")).toBe("follow");
    expect(parseArAnchorMode("marker")).toBe("marker");
    expect(parseArAnchorMode(undefined)).toBe("marker");
    expect(parseArAnchorMode(null)).toBe("marker");
    expect(parseArAnchorMode("orbit")).toBe("marker");
    expect(parseArAnchorMode(1)).toBe("marker");
  });

  it("is dirty after yaw, pitch, arAnchorMode, or decor changes", () => {
    const baseline = {
      yaw: -32,
      pitch: 8,
      arAnchorMode: "marker" as const,
      decor: [] as StudioDecorForSave[]
    };
    expect(isStartPoseDirty(baseline, baseline)).toBe(false);
    expect(isStartPoseDirty({ ...baseline, yaw: -17 }, baseline)).toBe(true);
    expect(isStartPoseDirty({ ...baseline, pitch: 18 }, baseline)).toBe(true);
    expect(isStartPoseDirty({ ...baseline, arAnchorMode: "follow" }, baseline)).toBe(true);
    expect(
      isStartPoseDirty(
        { ...baseline, decor: [{ id: "stars", x: 10, y: 20, yaw: 0, pitch: 0 }] },
        baseline
      )
    ).toBe(true);
  });

  it("persists decor with radians converted to degrees", () => {
    const body = buildStartTransformPatch({
      yaw: 0,
      pitch: 0,
      offset: { x: 0, y: 0, z: 0 },
      scale: 1,
      decor: [{ id: "tree", x: 70, y: 40, yaw: Math.PI / 2, pitch: 0 }]
    });
    expect(body.settings.scene.decor).toEqual([
      { id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 }
    ]);
  });

  it("persists only AR-capable decor and ignores Studio-only props for dirtiness", () => {
    const body = buildStartTransformPatch({
      yaw: 0,
      pitch: 0,
      offset: { x: 0, y: 0, z: 0 },
      scale: 1,
      decor: [
        { id: "cloud", x: 20, y: 16, yaw: 0, pitch: 0 },
        { id: "stars", x: 74, y: 14, yaw: 0, pitch: 0 }
      ]
    });
    expect(body.settings.scene.decor.map((item) => item.id)).toEqual(["stars"]);
    const pose = { yaw: 0, pitch: 0, arAnchorMode: "marker" as const };
    expect(
      isStartPoseDirty(
        { ...pose, decor: [{ id: "planet", x: 50, y: 20, yaw: 0, pitch: 0 }] },
        { ...pose, decor: [] }
      )
    ).toBe(false);
  });

  it("restores saved decor after reload with degrees back to radians", () => {
    const decor = persistedDecorToStudio([
      { id: "tree", x: 70, y: 40, yaw: 90, pitch: 0 },
      { id: "nope", x: 1, y: 1, yaw: 0, pitch: 0 }
    ]);
    expect(decor).toHaveLength(1);
    expect(decor[0]?.yaw).toBeCloseTo(Math.PI / 2, 6);
    const state = createWorkspaceState({ hasDrawing: true, yaw: null, pitch: null, decor });
    expect(state.decor).toHaveLength(1);
    expect(state.decor[0]).toMatchObject({ id: "tree", x: 70, y: 40 });
    expect(state.decor[0]?.key).toMatch(/^decor-/);
    expect(
      isStartPoseDirty(
        { yaw: 0, pitch: 0, arAnchorMode: "marker", decor: state.decor },
        { yaw: 0, pitch: 0, arAnchorMode: "marker", decor }
      )
    ).toBe(false);
  });

  it("hydrates arAnchorMode from project seed without leaking across workspaces", () => {
    const follow = createWorkspaceState({
      hasDrawing: true,
      yaw: 10,
      pitch: 4,
      arAnchorMode: "follow"
    });
    expect(follow).toMatchObject({
      orbitYaw: 10,
      orbitPitch: 4,
      arAnchorMode: "follow",
      animation: "follow"
    });
    const marker = createWorkspaceState({
      hasDrawing: true,
      yaw: null,
      pitch: null,
      arAnchorMode: "marker"
    });
    expect(marker.arAnchorMode).toBe("marker");
    expect(marker.animation).toBe("still");
    const missing = createWorkspaceState({
      hasDrawing: true,
      yaw: null,
      pitch: null,
      arAnchorMode: null
    });
    expect(missing.arAnchorMode).toBe("marker");
    expect(missing.animation).toBe("still");
  });

  it("describes fixture, dirty, saving, saved, and failed states", () => {
    const copy = getMessages("ro").personalize.startSave;
    expect(startSavePresentation({ hasProject: false, dirty: true, status: "idle", copy })).toEqual({
      label: copy.unavailable,
      disabled: true,
      hint: null
    });
    expect(startSavePresentation({ hasProject: true, dirty: false, status: "idle", copy })).toEqual({
      label: copy.save,
      disabled: true,
      hint: null
    });
    expect(startSavePresentation({ hasProject: true, dirty: true, status: "idle", copy })).toEqual({
      label: copy.save,
      disabled: false,
      hint: null
    });
    expect(startSavePresentation({ hasProject: true, dirty: true, status: "saving", copy })).toEqual({
      label: copy.saving,
      disabled: true,
      hint: null
    });
    expect(startSavePresentation({ hasProject: true, dirty: false, status: "saved", copy })).toEqual({
      label: copy.saved,
      disabled: true,
      hint: copy.hint
    });
    expect(startSavePresentation({ hasProject: true, dirty: true, status: "error", copy })).toEqual({
      label: copy.failed,
      disabled: false,
      hint: null
    });
    expect(getMessages("en").personalize.startSave.save).not.toMatch(/Salvează/);
  });

  it("PATCHes only the owned project route and reports failure for retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const body = buildStartTransformPatch({
      yaw: 10,
      pitch: 4,
      offset: { x: 0, y: 0, z: 0 },
      scale: 1
    });
    await expect(patchStartTransform("proj 1", body)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/proj%201", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    fetchMock.mockResolvedValueOnce({ ok: true });
    await expect(patchStartTransform("proj 1", body)).resolves.toBe(true);
    vi.unstubAllGlobals();
  });

  it("keeps the shell free of fetch and limits the writer to this PATCH", () => {
    const root = join(__dirname);
    const shell = readFileSync(join(root, "personalize-shell.tsx"), "utf8");
    const writer = readFileSync(join(root, "save-start-transform.ts"), "utf8");
    const page = readFileSync(join(root, "../../app/studio-preview/personalizeaza/page.tsx"), "utf8");
    expect(shell).not.toMatch(/\bfetch\s*\(/);
    expect(shell).toContain("patchStartTransform");
    expect(shell).toContain("buildStartTransformPatch");
    expect(shell).toContain("ANIMATIONS.map");
    expect(shell).toContain('type: "animation"');
    expect(shell).toContain("baselineArAnchorMode");
    expect(page).toContain("parseArAnchorMode");
    expect(page).toContain("arAnchorMode:");
    expect(page).toContain("persistedDecorToStudio");
    expect(shell).toContain("baselineDecor");
    expect(writer).toContain('method: "PATCH"');
    expect(writer).not.toMatch(/\b(POST|PUT|DELETE)\b/);
    expect(writer).not.toMatch(/\/api\/publish|getUserMedia|FormData/);
  });
});
