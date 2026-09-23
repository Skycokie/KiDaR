import { describe, expect, it, vi } from "vitest";
import {
  beginPresetCreate,
  beginSceneSave,
  completePresetCreate,
  completeSceneSave,
  completeSourceUpload,
  createInitialCreazaFormState,
  decideSceneCta,
  failSceneSave,
  isWritePathBlocked,
  selectExperience,
  selectPreset,
  setLocalSourceSuccess
} from "./form-state";
import {
  buildSceneSavePayload,
  interpretSceneSaveResponse,
  isProjectPatchPath,
  isWritableScene,
  patchSceneMode
} from "./save-scene";

function makeFile(name: string, type: string, size: number): File {
  const buffer = new Uint8Array(Math.min(size, 64));
  const blob = new Blob([buffer], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function withProjectReadyForScene() {
  let state = selectPreset(createInitialCreazaFormState(), "coloring");
  state = completePresetCreate(beginPresetCreate(state), "proj_1");
  state = setLocalSourceSuccess(
    state,
    {
      file: makeFile("poza.jpg", "image/jpeg", 40_000),
      objectUrl: "blob:poza",
      name: "poza.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 40_000
    },
    false
  );
  state = completeSourceUpload(state, "/api/files/source/src_1");
  state = selectExperience(state, "popout");
  return state;
}

describe("Scene Go B — patch helpers", () => {
  it("builds minimal mode-only payload", () => {
    expect(buildSceneSavePayload()).toEqual({ mode: "popout" });
    expect(isWritableScene("popout")).toBe(true);
    expect(isWritableScene("gallery")).toBe(false);
  });

  it("maps HTTP outcomes without extracting ProjectRecord", async () => {
    await expect(
      interpretSceneSaveResponse(jsonResponse(200, { project: { id: "p", owner: "u", mode: "popout" } }))
    ).resolves.toEqual({ ok: true });

    await expect(interpretSceneSaveResponse(jsonResponse(401, { error: "Unauthorized" }))).resolves.toEqual({
      ok: false,
      error: "auth"
    });
    await expect(
      interpretSceneSaveResponse(jsonResponse(404, { error: "Project not found" }))
    ).resolves.toEqual({ ok: false, error: "not-found" });
    await expect(
      interpretSceneSaveResponse(jsonResponse(400, { error: "Project name or settings are required" }))
    ).resolves.toEqual({ ok: false, error: "bad-request" });
    await expect(interpretSceneSaveResponse(jsonResponse(500, { error: "boom" }))).resolves.toEqual({
      ok: false,
      error: "generic"
    });
  });

  it("PATCHes exactly once with { mode: popout } and never posts source/publish", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { project: { id: "proj_1" } }));
    const result = await patchSceneMode("proj_1", fetchImpl);
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/proj_1");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ mode: "popout" });
    expect(url.includes("/source")).toBe(false);
    expect(url.includes("/publish")).toBe(false);
  });

  it("treats network failure as network error (no auto-retry)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(patchSceneMode("proj_1", fetchImpl)).resolves.toEqual({
      ok: false,
      error: "network"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Scene Go B — form decisions", () => {
  it("without projectId → local error, zero busy", () => {
    const state = selectExperience(createInitialCreazaFormState(), "popout");
    expect(decideSceneCta(state)).toEqual({ kind: "missing-project" });
    const next = beginSceneSave(state);
    expect(next.sceneError).toBe("missing-project");
    expect(next.sceneBusy).toBe(false);
    expect(next.step).toBe("preset");
  });

  it("gallery choice → invalid-scene, zero request", () => {
    let state = withProjectReadyForScene();
    state = selectExperience(state, "gallery");
    expect(decideSceneCta(state)).toEqual({ kind: "invalid-scene" });
    state = beginSceneSave(state);
    expect(state.sceneError).toBe("invalid-scene");
    expect(state.sceneBusy).toBe(false);
    expect(state.step).toBe("experienta");
  });

  it("valid projectId + popout → patch; busy then complete keeps local state only", () => {
    let state = withProjectReadyForScene();
    expect(decideSceneCta(state)).toEqual({ kind: "patch", projectId: "proj_1" });
    state = beginSceneSave(state);
    expect(state.sceneBusy).toBe(true);
    expect(beginSceneSave(state)).toEqual(state);

    state = completeSceneSave(state);
    expect(state.step).toBe("confirmare");
    expect(state.sceneBusy).toBe(false);
    expect(state.experience).toBe("popout");
    expect(state.projectId).toBe("proj_1");
    expect(state.sourceUrl).toBe("/api/files/source/src_1");
    expect(Object.keys(state).includes("owner")).toBe(false);
    expect(Object.keys(state).includes("settings")).toBe(false);
  });

  it("auth/not-found/generic stay on Scenă with choice preserved", () => {
    let state = withProjectReadyForScene();
    state = beginSceneSave(state);
    state = failSceneSave(state, "auth");
    expect(state.step).toBe("experienta");
    expect(state.sceneError).toBe("auth");
    expect(state.experience).toBe("popout");
    expect(state.sceneBusy).toBe(false);
  });

  it("allows create + source + project PATCH; blocks asset/publish/magic-link", () => {
    expect(isWritePathBlocked("/api/projects")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/source")).toBe(false);
    expect(isProjectPatchPath("/api/projects/x")).toBe(true);
    expect(isWritePathBlocked("/api/projects/x")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/asset")).toBe(true);
    expect(isWritePathBlocked("/api/publish")).toBe(true);
    expect(isWritePathBlocked("/api/auth/magic-link")).toBe(true);
  });
});
