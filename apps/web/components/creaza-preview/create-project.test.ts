import { describe, expect, it, vi } from "vitest";
import {
  CREATE_PROJECT_PATH,
  buildCreateProjectPayload,
  extractCreatedProjectId,
  interpretCreateProjectResponse,
  postCreateProject
} from "./create-project";
import {
  beginPresetCreate,
  completePresetCreate,
  createInitialCreazaFormState,
  decidePresetCta,
  failPresetCreate,
  goBack,
  isCreateProjectAllowed,
  isWritePathBlocked,
  resumeExistingDraft,
  selectPreset,
  setLocalSourceSuccess
} from "./form-state";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function makeTinyFile(): File {
  return new File([new Uint8Array(8)], "keep.jpg", { type: "image/jpeg" });
}

describe("Create Go B — payload and response", () => {
  it("builds the frozen Atelier payload with popout mode", () => {
    const payload = buildCreateProjectPayload("story", new Date("2026-09-21T12:00:00Z"));
    expect(payload.mode).toBe("popout");
    expect(payload.settings).toEqual({ preset: "story" });
    expect(payload.name.length).toBeGreaterThan(0);
    expect(payload.name.startsWith("Surpriza din")).toBe(true);
  });

  it("extracts only project.id (or $id) and ignores other fields", () => {
    expect(
      extractCreatedProjectId({
        project: {
          id: "proj_1",
          owner: "user_x",
          source_image_path: "should-not-leak",
          settings: { theme: "#000" }
        }
      })
    ).toBe("proj_1");
    expect(extractCreatedProjectId({ project: { $id: "proj_legacy" } })).toBe("proj_legacy");
    expect(extractCreatedProjectId({ project: {} })).toBeNull();
  });

  it("maps HTTP outcomes without auto-retry semantics", async () => {
    await expect(
      interpretCreateProjectResponse(jsonResponse(201, { project: { id: "a1" } }))
    ).resolves.toEqual({ ok: true, projectId: "a1" });

    await expect(interpretCreateProjectResponse(jsonResponse(401, { error: "Unauthorized" }))).resolves.toEqual({
      ok: false,
      error: "auth"
    });

    await expect(
      interpretCreateProjectResponse(
        jsonResponse(403, { error: "quota_exceeded", upgrade: true })
      )
    ).resolves.toEqual({ ok: false, error: "quota" });

    await expect(interpretCreateProjectResponse(jsonResponse(500, { error: "boom" }))).resolves.toEqual({
      ok: false,
      error: "generic"
    });

    await expect(interpretCreateProjectResponse(jsonResponse(201, { project: {} }))).resolves.toEqual({
      ok: false,
      error: "ambiguous"
    });
  });

  it("posts exactly once to /api/projects and never to source/publish", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { project: { id: "created_1" } }));
    const result = await postCreateProject(buildCreateProjectPayload("coloring"), fetchImpl);
    expect(result).toEqual({ ok: true, projectId: "created_1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CREATE_PROJECT_PATH);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    const body = JSON.parse(String(init.body)) as { mode: string; settings: { preset: string } };
    expect(body.mode).toBe("popout");
    expect(body.settings.preset).toBe("coloring");
    expect(url.includes("/source")).toBe(false);
    expect(url.includes("/publish")).toBe(false);
  });

  it("treats network failure as ambiguous (no auto-retry)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(postCreateProject(buildCreateProjectPayload("mission"), fetchImpl)).resolves.toEqual({
      ok: false,
      error: "ambiguous"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Create Go B — form state", () => {
  it("requires preset before create and does not leave the step", () => {
    const next = beginPresetCreate(createInitialCreazaFormState());
    expect(next.presetError).toBe("select");
    expect(next.presetBusy).toBe(false);
    expect(next.step).toBe("preset");
    expect(next.projectId).toBeNull();
    expect(decidePresetCta(createInitialCreazaFormState())).toEqual({ kind: "select-error" });
  });

  it("blocks a second begin while busy (double-submit)", () => {
    let state = selectPreset(createInitialCreazaFormState(), "coloring");
    state = beginPresetCreate(state);
    expect(state.presetBusy).toBe(true);
    const again = beginPresetCreate(state);
    expect(again).toEqual(state);
  });

  it("on 201 keeps only projectId and moves to foto", () => {
    let state = selectPreset(createInitialCreazaFormState(), "story");
    state = beginPresetCreate(state);
    state = completePresetCreate(state, "proj_abc");
    expect(state.step).toBe("foto");
    expect(state.projectId).toBe("proj_abc");
    expect(state.presetBusy).toBe(false);
    expect(Object.keys(state).includes("owner")).toBe(false);
  });

  it("after back to Pornire with projectId, CTA resumes Poză without create", () => {
    let state = selectPreset(createInitialCreazaFormState(), "coloring");
    state = beginPresetCreate(state);
    state = completePresetCreate(state, "proj_reuse");
    state = setLocalSourceSuccess(
      state,
      {
        file: makeTinyFile(),
        objectUrl: "blob:keep",
        name: "keep.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 8
      },
      false
    );
    state = goBack(state);
    expect(state.step).toBe("preset");
    expect(state.projectId).toBe("proj_reuse");
    expect(state.localSource?.objectUrl).toBe("blob:keep");

    expect(decidePresetCta(state)).toEqual({ kind: "resume", projectId: "proj_reuse" });
    const resumed = resumeExistingDraft(state);
    expect(resumed.step).toBe("foto");
    expect(resumed.projectId).toBe("proj_reuse");
    expect(resumed.preset).toBe("coloring");
    expect(resumed.localSource?.name).toBe("keep.jpg");
    expect(resumed.presetBusy).toBe(false);
    expect(beginPresetCreate(state).step).toBe("foto");
    expect(beginPresetCreate(state).presetBusy).toBe(false);
  });

  it("without projectId, valid preset decides create (single POST path)", () => {
    const state = selectPreset(createInitialCreazaFormState(), "mission");
    expect(decidePresetCta(state)).toEqual({ kind: "create", preset: "mission" });
  });

  it("surfaces auth/quota/generic/ambiguous without navigation", () => {
    let state = selectPreset(createInitialCreazaFormState(), "mission");
    state = beginPresetCreate(state);
    state = failPresetCreate(state, "quota");
    expect(state.step).toBe("preset");
    expect(state.presetError).toBe("quota");
    expect(state.presetBusy).toBe(false);
    expect(state.projectId).toBeNull();
  });

  it("allows create path but still blocks publish/magic-link and non-patch project subpaths", () => {
    expect(isCreateProjectAllowed("/api/projects")).toBe(true);
    expect(isWritePathBlocked("/api/projects")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/source")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/asset")).toBe(true);
    expect(isWritePathBlocked("/api/auth/magic-link")).toBe(true);
    expect(isWritePathBlocked("/api/publish")).toBe(true);
  });
});
