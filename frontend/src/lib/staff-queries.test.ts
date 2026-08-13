import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteHealer, fetchHealers, healerListKey } from "./staff-queries";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("healerListKey", () => {
  it("namespaces by district", () => {
    expect(healerListKey(3)).toEqual(["healers", 3]);
  });
});

describe("fetchHealers", () => {
  it("reads the proxied list endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ id: 1 }] }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await fetchHealers(3);
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/districts/3/healers", expect.anything());
  });
});

describe("deleteHealer", () => {
  it("DELETEs through the bff and throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409 })) as unknown as typeof fetch);
    await expect(deleteHealer(1)).rejects.toThrow();
  });
});
