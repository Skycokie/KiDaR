import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultLocale, supportedLocales } from "./config";
import { getMessages } from "./get-messages";
import {
  hrefForLocale,
  localeFromAcceptLanguage,
  localizedPath,
  normalizeLocale,
  resolveLocale,
  shouldLocalizePath,
  splitLocalePrefix
} from "./locale";

describe("locale resolution", () => {
  it("supports only Romanian and English", () => {
    expect(supportedLocales).toEqual(["ro", "en"]);
    expect(defaultLocale).toBe("ro");
  });

  it("normalizes BCP 47 tags and rejects unsupported locales", () => {
    expect(normalizeLocale("ro")).toBe("ro");
    expect(normalizeLocale("EN-us")).toBe("en");
    expect(normalizeLocale(" ro ")).toBe("ro");
    expect(normalizeLocale("de")).toBeNull();
    expect(normalizeLocale("fr")).toBeNull();
    expect(normalizeLocale("../en")).toBeNull();
    expect(normalizeLocale("")).toBeNull();
  });

  it("falls back to Romanian when the locale is missing or unsupported", () => {
    expect(resolveLocale({})).toBe("ro");
    expect(resolveLocale({ pathLocale: "de", cookie: "fr", acceptLanguage: "it" })).toBe("ro");
    expect(getMessages("de").landing.title).toBe("Desenul tău prinde viață.");
    expect(getMessages("en").landing.title).toBe("Your drawing comes to life.");
    expect(getMessages("ro").auth.title).toBe("Intră în kiDAR");
    expect(getMessages("en").auth.submit).toBe("Send sign-in link");
  });

  it("lets an explicit choice override Accept-Language", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.8,ro;q=0.2")).toBe("en");
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.5")).toBeNull();
    expect(resolveLocale({ acceptLanguage: "en-US", cookie: "ro" })).toBe("ro");
    expect(resolveLocale({ acceptLanguage: "ro", pathLocale: "en" })).toBe("en");
  });

  it("keeps unprefixed routes and builds prefixed ones without auth secrets", () => {
    expect(splitLocalePrefix("/login")).toEqual({ locale: null, pathname: "/login" });
    expect(splitLocalePrefix("/en/login")).toEqual({ locale: "en", pathname: "/login" });
    expect(splitLocalePrefix("/ro")).toEqual({ locale: "ro", pathname: "/" });
    expect(shouldLocalizePath("/login")).toBe(true);
    expect(shouldLocalizePath("/auth/callback")).toBe(false);
    expect(shouldLocalizePath("/api/auth/magic-link")).toBe(false);
    expect(hrefForLocale("/intra", "ro")).toBe("/intra");
    expect(hrefForLocale("/login", "en")).toBe("/en/login");
    expect(localizedPath("/en/login", "userId=abc&secret=xyz&next=%2Fcreaza", "ro")).toBe(
      "/ro/login?next=%2Fcreaza"
    );
    expect(localizedPath("/auth/callback", "token=secret", "en")).not.toContain("token");
  });
});

describe("callback route stays a confirm step", () => {
  it("does not create a session on GET and still confirms on POST", () => {
    const source = readFileSync(join(__dirname, "../app/auth/callback/route.ts"), "utf8");
    const getStart = source.indexOf("export async function GET");
    const postStart = source.indexOf("export async function POST");
    const getSource = source.slice(getStart, postStart);
    expect(getStart).toBeGreaterThan(-1);
    expect(postStart).toBeGreaterThan(getStart);
    expect(getSource).not.toContain("createSession");
    expect(getSource).not.toContain("updateMagicURLSession");
    expect(getSource).toContain('method="post"');
    expect(getSource).toContain('action="/auth/callback"');
    expect(source).toContain("updateMagicURLSession");
    expect(source).toContain("createSession");
  });
});
