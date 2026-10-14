import { describe, expect, it } from "vitest";
import { UPLOAD_ARTIFACT_KIND, UploadModelError, uploadArtifactKey } from "./upload-model";

describe("uploadArtifactKey", () => {
  it("builds models/<project>/<hash>/upload.glb", () => {
    expect(uploadArtifactKey("proj_1", "abc123def")).toBe(`models/proj_1/abc123def/${UPLOAD_ARTIFACT_KIND}`);
  });

  it("sanitizes project id and rejects empty hash", () => {
    expect(uploadArtifactKey("weird/id!", "deadbeef")).toBe(`models/weirdid/deadbeef/${UPLOAD_ARTIFACT_KIND}`);
    expect(() => uploadArtifactKey("proj", "")).toThrow(UploadModelError);
  });
});
