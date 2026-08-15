import { describe, expect, it } from "vitest";
import { swapLocalePath } from "./LanguageSwitcher";

describe("swapLocalePath", () => {
  it("swaps a leading locale segment", () => {
    expect(swapLocalePath("/th/herbs/1", "en")).toBe("/en/herbs/1");
    expect(swapLocalePath("/en/staff", "th")).toBe("/th/staff");
  });
  it("swaps the bare locale root", () => {
    expect(swapLocalePath("/th", "en")).toBe("/en");
  });
  it("adds a prefix when none is present", () => {
    expect(swapLocalePath("/herbs", "en")).toBe("/en/herbs");
  });
});
