import { describe, expect, it, vi } from "vitest";
import {
  projectAssetPath,
  searchGalleryModels,
  selectGalleryModel,
  postImportedGlbFile
} from "./import-model-client";

describe("import-model-client", () => {
  it("builds asset path with encoding", () => {
    expect(projectAssetPath("abc 1")).toBe("/api/projects/abc%201/asset");
  });

  it("maps gallery search results with glb urls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { id: "1", name: "Dragon", thumbnailUrl: null, glbUrl: "https://cdn.example.com/a.glb" },
          { id: "2", name: "Empty", thumbnailUrl: null, glbUrl: null }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchGalleryModels("dragon")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/gallery?query=dragon", { cache: "no-store" });
    vi.unstubAllGlobals();
  });

  it("patches gallery selection onto the project", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await selectGalleryModel("proj1", "https://cdn.example.com/a.glb");
    expect(result).toEqual({
      ok: true,
      modelUrl: "https://cdn.example.com/a.glb",
      publicUrl: "https://cdn.example.com/a.glb",
      promoted: true,
      source: "gallery"
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/proj1", expect.objectContaining({ method: "PATCH" }));
    vi.unstubAllGlobals();
  });

  it("posts a glb file to the asset route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://signed.example/a",
        publicUrl: "https://cdn.example.com/a.glb",
        promoted: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "hero.glb", { type: "model/gltf-binary" });
    const result = await postImportedGlbFile("proj1", file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publicUrl).toBe("https://cdn.example.com/a.glb");
      expect(result.source).toBe("file");
    }
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/proj1/asset", expect.objectContaining({ method: "POST" }));
    vi.unstubAllGlobals();
  });
});
