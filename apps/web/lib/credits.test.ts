import { describe, expect, it } from "vitest";
import {
  FIGURINE_CREDIT_COST,
  creditsPerStripePack,
  isCreditsBypassEnabled
} from "./credits";

describe("credits helpers", () => {
  it("keeps figurine cost at one credit per new job", () => {
    expect(FIGURINE_CREDIT_COST).toBe(1);
  });

  it("honors BYPASS_CREDITS only in development", () => {
    expect(isCreditsBypassEnabled({ NODE_ENV: "development", BYPASS_CREDITS: "true" })).toBe(
      true
    );
    expect(isCreditsBypassEnabled({ NODE_ENV: "production", BYPASS_CREDITS: "true" })).toBe(
      false
    );
    expect(isCreditsBypassEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("parses STRIPE_CREDITS_PER_PACK strictly", () => {
    expect(creditsPerStripePack({})).toBeNull();
    expect(creditsPerStripePack({ STRIPE_CREDITS_PER_PACK: "10" })).toBe(10);
    expect(creditsPerStripePack({ STRIPE_CREDITS_PER_PACK: "0" })).toBeNull();
    expect(creditsPerStripePack({ STRIPE_CREDITS_PER_PACK: "1.5" })).toBeNull();
  });
});
