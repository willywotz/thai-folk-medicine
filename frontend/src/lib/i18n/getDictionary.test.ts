import { describe, expect, it, vi } from "vitest";

const langMock = vi.fn();
const notFoundMock = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/root-params", () => ({ lang: () => langMock() }));
vi.mock("next/navigation", () => ({ notFound: () => notFoundMock() }));

import { getDictionary, getLocale } from "./getDictionary";

describe("getDictionary", () => {
  it("returns the en dictionary for en", async () => {
    langMock.mockResolvedValue("en");
    const dict = await getDictionary();
    expect(dict.common.home).toBe("Home");
  });
  it("returns the th dictionary for th", async () => {
    langMock.mockResolvedValue("th");
    const dict = await getDictionary();
    expect(dict.common.home).toBe("หน้าแรก");
  });
  it("calls notFound for an unknown locale", async () => {
    langMock.mockResolvedValue("fr");
    await expect(getDictionary()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
  it("getLocale returns the resolved locale", async () => {
    langMock.mockResolvedValue("en");
    expect(await getLocale()).toBe("en");
  });
});
