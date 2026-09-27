import { describe, expect, it } from "vitest";
import {
  FIGURINE_ERROR_COPY,
  figurineApiPath,
  interpretFigurineStatus,
  interpretStartFigurineResponse,
  pickFigurineModelUrl,
  shouldPollFigurine
} from "./generate-figurine";

describe("generate-figurine", () => {
  it("builds the existing studio figurine route", () => {
    expect(figurineApiPath("abc 1")).toBe("/api/projects/abc%201/figurine");
  });

  it("prefers the job public URL, then the project model URL", () => {
    expect(
      pickFigurineModelUrl({
        figurineModelUrl: "https://cdn.example/project.glb",
        job: { publicUrl: "https://cdn.example/job.glb" }
      })
    ).toBe("https://cdn.example/job.glb");
    expect(pickFigurineModelUrl({ figurineModelUrl: "https://cdn.example/project.glb", job: null })).toBe(
      "https://cdn.example/project.glb"
    );
    expect(pickFigurineModelUrl({ figurineModelUrl: null, job: { publicUrl: null } })).toBeNull();
  });

  it("polls only while the Tripo job is in flight", () => {
    expect(shouldPollFigurine(null)).toBe(false);
    expect(shouldPollFigurine({ status: "running", phase: "provider_running", progress: 40, label: "", publicUrl: null })).toBe(
      true
    );
    expect(shouldPollFigurine({ status: "done", phase: "ready", progress: 100, label: "", publicUrl: "x" })).toBe(false);
    expect(shouldPollFigurine({ status: "error", phase: "failed", progress: 0, label: "", publicUrl: null })).toBe(false);
  });

  it("maps start failures without inventing a model", () => {
    expect(interpretStartFigurineResponse(201, { label: "În pregătire" })).toEqual({
      ok: true,
      label: "În pregătire"
    });
    expect(interpretStartFigurineResponse(401, {})).toEqual({ ok: false, error: "auth" });
    expect(interpretStartFigurineResponse(403, { error: "generation_disabled" })).toEqual({
      ok: false,
      error: "gated"
    });
    expect(interpretStartFigurineResponse(409, { error: "active_job" })).toEqual({
      ok: false,
      error: "active"
    });
    expect(FIGURINE_ERROR_COPY.gated).toMatch(/activată/);
  });

  it("reads owner preview URLs from the figurine status payload", () => {
    const status = interpretFigurineStatus({
      availability: { available: true, message: "" },
      figurineModelUrl: "https://cdn.example/figure.glb",
      job: { status: "done", phase: "ready", progress: 100, label: "Gata", publicUrl: null }
    });
    expect(status.modelUrl).toBe("https://cdn.example/figure.glb");
    expect(status.job?.phase).toBe("ready");
  });
});
