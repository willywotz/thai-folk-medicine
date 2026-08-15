import { describe, expect, it } from "vitest";
import { defaultLocale, hasLocale, locales } from "./config";

describe("i18n config", () => {
  it("lists th then en, default th", () => {
    expect(locales).toEqual(["th", "en"]);
    expect(defaultLocale).toBe("th");
  });
  it("narrows known locales", () => {
    expect(hasLocale("th")).toBe(true);
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("fr")).toBe(false);
  });
});
