import { describe, expect, it } from "vitest";
import { isQuotaBypassEnabled, projectQuotaLimit } from "./quota";

describe("isQuotaBypassEnabled", () => {
  it("is off in production even when BYPASS_QUOTA is true", () => {
    expect(
      isQuotaBypassEnabled({ NODE_ENV: "production", BYPASS_QUOTA: "true" })
    ).toBe(false);
  });

  it("is off in development unless the flag is explicit", () => {
    expect(isQuotaBypassEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isQuotaBypassEnabled({ NODE_ENV: "development", BYPASS_QUOTA: "0" })).toBe(false);
  });

  it("is on only in development with true/1", () => {
    expect(
      isQuotaBypassEnabled({ NODE_ENV: "development", BYPASS_QUOTA: "true" })
    ).toBe(true);
    expect(isQuotaBypassEnabled({ NODE_ENV: "development", BYPASS_QUOTA: "1" })).toBe(true);
  });
});

describe("projectQuotaLimit", () => {
  it("returns plan budgets", () => {
    expect(projectQuotaLimit("free")).toBe(3);
    expect(projectQuotaLimit("paid")).toBe(30);
  });
});
