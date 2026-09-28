import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "@/i18n/get-messages";
import {
  buildStartTransformPatch,
  isStartPoseDirty,
  patchStartTransform,
  startSavePresentation
} from "./save-start-transform";

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
          startTransform: {
            rotation: { x: 8, y: -32, z: 180 },
            position: { x: 0.2, y: -0.1, z: 0.4 },
            scale: 1.4
          }
        }
      }
    });
    expect(JSON.stringify(body)).not.toContain("zoom");
    expect(Object.keys(body.settings)).toEqual(["scene"]);
  });

  it("is dirty only after yaw or pitch moves", () => {
    expect(isStartPoseDirty({ yaw: -32, pitch: 8 }, { yaw: -32, pitch: 8 })).toBe(false);
    expect(isStartPoseDirty({ yaw: -17, pitch: 8 }, { yaw: -32, pitch: 8 })).toBe(true);
    expect(isStartPoseDirty({ yaw: -32, pitch: 18 }, { yaw: -32, pitch: 8 })).toBe(true);
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
    expect(shell).not.toMatch(/\bfetch\s*\(/);
    expect(shell).toContain("patchStartTransform");
    expect(shell).toContain("buildStartTransformPatch");
    expect(writer).toContain('method: "PATCH"');
    expect(writer).not.toMatch(/\b(POST|PUT|DELETE)\b/);
    expect(writer).not.toMatch(/\/api\/publish|getUserMedia|FormData/);
  });
});
