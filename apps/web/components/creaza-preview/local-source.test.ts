import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyFotoFixture,
  clearLocalSource,
  createInitialCreazaFormState,
  selectPreset,
  beginPresetCreate,
  completePresetCreate,
  completeSourceUpload,
  beginSourceUpload,
  setLocalSourceFailure,
  setLocalSourceSuccess
} from "./form-state";
import { buildLocalSourceImage, pickFirstImageFile, revokeLocalSourceImage } from "./local-source";

function makeFile(name: string, type: string, size: number): File {
  const buffer = new Uint8Array(Math.min(size, 64));
  const blob = new Blob([buffer], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("creaza-preview local File preview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pickFirstImageFile reads the first FileList entry", () => {
    const file = makeFile("a.jpg", "image/jpeg", 1200);
    const list = {
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      0: file
    } as unknown as FileList;
    expect(pickFirstImageFile(list)?.name).toBe("a.jpg");
    expect(pickFirstImageFile(null)).toBeNull();
  });

  it("buildLocalSourceImage rejects invalid mime without creating a lasting preview need", async () => {
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const result = await buildLocalSourceImage(makeFile("x.pdf", "application/pdf", 2000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("type");
    expect(createSpy).not.toHaveBeenCalled();
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("buildLocalSourceImage accepts jpeg and returns LocalSourceImage", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-1");
    // Skip decode path noise in jsdom
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 640;
        naturalHeight = 480;
        set src(_v: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );

    const result = await buildLocalSourceImage(makeFile("desen.jpg", "image/jpeg", 50_000));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.objectUrl).toBe("blob:preview-1");
      expect(result.image.name).toBe("desen.jpg");
      expect(result.image.width).toBe(640);
      expect(result.image.sizeBytes).toBe(50_000);
      revokeLocalSourceImage(result.image);
    }
  });

  it("setLocalSourceSuccess stores real preview and clears fixture name", () => {
    let state = createInitialCreazaFormState();
    state = selectPreset(state, "coloring");
    state = completePresetCreate(beginPresetCreate(state), "proj_local");
    state = applyFotoFixture(state, "selected");
    expect(state.fotoMockName).toBeTruthy();

    const image = {
      file: makeFile("live.jpg", "image/jpeg", 40_000),
      objectUrl: "blob:live",
      name: "live.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 40_000
    };
    state = setLocalSourceSuccess(state, image, false);
    expect(state.localSource?.name).toBe("live.jpg");
    expect(state.fotoMockName).toBeNull();
    expect(state.fotoUi).toBe("selected");
    state = beginSourceUpload(state);
    expect(state.fotoBusy).toBe(true);
    state = completeSourceUpload(state, "/api/files/source/src_live");
    expect(state.step).toBe("experienta");
    expect(state.sourceUrl).toBe("/api/files/source/src_live");
  });

  it("setLocalSourceFailure and clearLocalSource leave no localSource", () => {
    let state = createInitialCreazaFormState();
    state = setLocalSourceFailure(state, "size");
    expect(state.localSource).toBeNull();
    expect(state.fotoError).toBe("size");

    state = setLocalSourceSuccess(
      state,
      {
        file: makeFile("ok.png", "image/png", 20_000),
        objectUrl: "blob:ok",
        name: "ok.png",
        mimeType: "image/png",
        sizeBytes: 20_000
      },
      false
    );
    state = clearLocalSource(state);
    expect(state.localSource).toBeNull();
    expect(state.fotoUi).toBe("empty");
  });
});
