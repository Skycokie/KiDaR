import { describe, expect, it } from "vitest";
import {
  arScanHonestyCopy,
  arScanIdleCopy,
  canContinueWithoutScan,
  canProjectFigurine,
  canStartCamera,
  reduceArScanState,
  type ArScanState
} from "./ar-scan-state";

describe("reduceArScanState", () => {
  it("moves idle to camera on START_CAMERA", () => {
    expect(reduceArScanState("idle", { type: "START_CAMERA" }).state).toBe("camera");
  });

  it("moves camera to recognized on MATCH_STABLE", () => {
    expect(reduceArScanState("camera", { type: "MATCH_STABLE" }).state).toBe("recognized");
  });

  it("moves camera to timeout on SCAN_TIMEOUT", () => {
    expect(reduceArScanState("camera", { type: "SCAN_TIMEOUT" }).state).toBe("timeout");
  });

  it("moves idle/camera to unavailable on CAMERA_UNAVAILABLE", () => {
    expect(
      reduceArScanState("idle", { type: "CAMERA_UNAVAILABLE", reason: "no cam" }).state
    ).toBe("unavailable");
    expect(
      reduceArScanState("camera", { type: "CAMERA_UNAVAILABLE", reason: "denied" }).reason
    ).toBe("denied");
  });

  it("allows CONTINUE_WITHOUT_SCAN from timeout and unavailable", () => {
    expect(reduceArScanState("timeout", { type: "CONTINUE_WITHOUT_SCAN" }).state).toBe(
      "projecting"
    );
    expect(reduceArScanState("unavailable", { type: "CONTINUE_WITHOUT_SCAN" }).state).toBe(
      "projecting"
    );
  });

  it("allows PROJECT from recognized", () => {
    expect(reduceArScanState("recognized", { type: "PROJECT" }).state).toBe("projecting");
  });

  it("ignores MATCH_STABLE outside camera", () => {
    expect(reduceArScanState("idle", { type: "MATCH_STABLE" }).state).toBe("idle");
    expect(reduceArScanState("recognized", { type: "MATCH_STABLE" }).state).toBe("recognized");
  });

  it("resets to idle", () => {
    const from: ArScanState = "projecting";
    expect(reduceArScanState(from, { type: "RESET" }).state).toBe("idle");
  });
});

describe("ar-scan helpers", () => {
  it("exposes honest free-placement copy", () => {
    expect(arScanHonestyCopy()).toMatch(/suprafață reală/i);
    expect(arScanIdleCopy()).toMatch(/Scanează desenul/i);
  });

  it("gates primary actions by state", () => {
    expect(canStartCamera("idle")).toBe(true);
    expect(canStartCamera("camera")).toBe(false);
    expect(canProjectFigurine("recognized")).toBe(true);
    expect(canProjectFigurine("camera")).toBe(false);
    expect(canContinueWithoutScan("timeout")).toBe(true);
    expect(canContinueWithoutScan("recognized")).toBe(false);
  });
});
