import { describe, expect, it } from "vitest";
import { isStagingRuntime } from "./staging-runtime";

describe("isStagingRuntime", () => {
  it("is false on production / unset", () => {
    expect(isStagingRuntime({})).toBe(false);
    expect(isStagingRuntime({ KIDAR_RUNTIME_ENV: "production" })).toBe(false);
    expect(isStagingRuntime({ KIDAR_RUNTIME_ENV: "" })).toBe(false);
  });

  it("is true only for staging", () => {
    expect(isStagingRuntime({ KIDAR_RUNTIME_ENV: "staging" })).toBe(true);
    expect(isStagingRuntime({ KIDAR_RUNTIME_ENV: "Staging" })).toBe(true);
  });
});
