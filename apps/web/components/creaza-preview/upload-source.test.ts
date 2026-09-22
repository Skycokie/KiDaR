import { describe, expect, it, vi } from "vitest";
import {
  beginSourceUpload,
  completeSourceUpload,
  createInitialCreazaFormState,
  decideSourceCta,
  failSourceUpload,
  isWritePathBlocked,
  selectPreset,
  beginPresetCreate,
  completePresetCreate,
  setLocalSourceSuccess
} from "./form-state";
import {
  buildSourceUploadFormData,
  extractSourceUrl,
  interpretSourceUploadResponse,
  isSourceUploadPath,
  postSourceUpload
} from "./upload-source";

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

function withProjectAndPhoto() {
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
  return state;
}

describe("Source Go B — upload helpers", () => {
  it("builds multipart FormData with file field only", () => {
    const file = makeFile("a.jpg", "image/jpeg", 1000);
    const body = buildSourceUploadFormData(file);
    expect(body.get("file")).toBe(file);
  });

  it("extracts only sourceUrl from success body", () => {
    expect(
      extractSourceUrl({
        project: { id: "x", owner: "u", source_image_path: "secret" },
        sourceUrl: "/api/files/bucket/src_1"
      })
    ).toBe("/api/files/bucket/src_1");
    expect(extractSourceUrl({ project: { id: "x" } })).toBeNull();
  });

  it("maps HTTP outcomes without auto-retry", async () => {
    await expect(
      interpretSourceUploadResponse(
        jsonResponse(200, { sourceUrl: "/api/files/b/f", project: { id: "p" } })
      )
    ).resolves.toEqual({ ok: true, sourceUrl: "/api/files/b/f" });

    await expect(interpretSourceUploadResponse(jsonResponse(401, { error: "Unauthorized" }))).resolves.toEqual({
      ok: false,
      error: "auth"
    });
    await expect(
      interpretSourceUploadResponse(jsonResponse(404, { error: "Project not found" }))
    ).resolves.toEqual({ ok: false, error: "not-found" });
    await expect(interpretSourceUploadResponse(jsonResponse(413, { error: "too big" }))).resolves.toEqual({
      ok: false,
      error: "size"
    });
    await expect(interpretSourceUploadResponse(jsonResponse(415, { error: "type" }))).resolves.toEqual({
      ok: false,
      error: "type"
    });
    await expect(interpretSourceUploadResponse(jsonResponse(500, { error: "boom" }))).resolves.toEqual({
      ok: false,
      error: "generic"
    });
  });

  it("posts exactly once to …/source multipart and never to PATCH/publish", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { sourceUrl: "/api/files/source/src_1", project: { id: "proj_1" } })
    );
    const file = makeFile("poza.jpg", "image/jpeg", 12_000);
    const result = await postSourceUpload("proj_1", file, fetchImpl);
    expect(result).toEqual({ ok: true, sourceUrl: "/api/files/source/src_1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/proj_1/source");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(url.includes("/publish")).toBe(false);
    expect(init.method).not.toBe("PATCH");
  });

  it("treats network failure as network error (no auto-retry)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(postSourceUpload("proj_1", makeFile("a.jpg", "image/jpeg", 1000), fetchImpl)).resolves.toEqual({
      ok: false,
      error: "network"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Source Go B — form decisions", () => {
  it("without projectId → zero upload decision", () => {
    const state = setLocalSourceSuccess(
      createInitialCreazaFormState(),
      {
        file: makeFile("poza.jpg", "image/jpeg", 40_000),
        objectUrl: "blob:x",
        name: "poza.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 40_000
      },
      false
    );
    expect(decideSourceCta(state)).toEqual({ kind: "missing-project" });
    expect(beginSourceUpload(state).uploadError).toBe("missing-project");
    expect(beginSourceUpload(state).fotoBusy).toBe(false);
  });

  it("without photo or with fixture only → missing-photo, zero busy", () => {
    let state = selectPreset(createInitialCreazaFormState(), "story");
    state = completePresetCreate(beginPresetCreate(state), "proj_2");
    expect(decideSourceCta(state)).toEqual({ kind: "missing-photo" });
    state = beginSourceUpload(state);
    expect(state.step).toBe("foto");
    expect(state.uploadError).toBe("missing-photo");
    expect(state.fotoBusy).toBe(false);
  });

  it("valid projectId + photo → upload decision; busy then complete stores only sourceUrl", () => {
    let state = withProjectAndPhoto();
    const decision = decideSourceCta(state);
    expect(decision.kind).toBe("upload");
    if (decision.kind === "upload") {
      expect(decision.projectId).toBe("proj_1");
      expect(decision.file.name).toBe("poza.jpg");
    }
    state = beginSourceUpload(state);
    expect(state.fotoBusy).toBe(true);
    expect(beginSourceUpload(state)).toEqual(state);

    state = completeSourceUpload(state, "/api/files/source/src_abc");
    expect(state.step).toBe("experienta");
    expect(state.sourceUrl).toBe("/api/files/source/src_abc");
    expect(state.fotoBusy).toBe(false);
    expect(state.localSource?.objectUrl).toBe("blob:poza");
    expect(Object.keys(state).includes("owner")).toBe(false);
  });

  it("auth/not-found/generic stay on foto without navigation", () => {
    let state = withProjectAndPhoto();
    state = beginSourceUpload(state);
    state = failSourceUpload(state, "not-found");
    expect(state.step).toBe("foto");
    expect(state.uploadError).toBe("not-found");
    expect(state.fotoBusy).toBe(false);
    expect(state.sourceUrl).toBeNull();
  });

  it("allows create + source paths; blocks asset/publish (project PATCH allowed by Scene Go B)", () => {
    expect(isWritePathBlocked("/api/projects")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/source")).toBe(false);
    expect(isSourceUploadPath("/api/projects/x/source")).toBe(true);
    expect(isWritePathBlocked("/api/projects/x")).toBe(false);
    expect(isWritePathBlocked("/api/projects/x/asset")).toBe(true);
    expect(isWritePathBlocked("/api/publish")).toBe(true);
    expect(isWritePathBlocked("/api/auth/magic-link")).toBe(true);
  });
});
