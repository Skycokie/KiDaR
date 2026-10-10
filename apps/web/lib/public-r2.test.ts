import { describe, expect, it } from "vitest";
import { isWebPublicR2Ready } from "./public-r2";

describe("isWebPublicR2Ready", () => {
  it("is false without R2 env", () => {
    expect(isWebPublicR2Ready({})).toBe(false);
  });

  it("is true with complete R2 env", () => {
    expect(
      isWebPublicR2Ready({
        R2_ACCOUNT_ID: "acct",
        R2_ACCESS_KEY_ID: "ak",
        R2_SECRET_ACCESS_KEY: "sk",
        R2_BUCKET: "kidar-public-ar",
        R2_PUBLIC_BASE_URL: "https://ar.example.com"
      })
    ).toBe(true);
  });
});
