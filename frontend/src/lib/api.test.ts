import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getHealer,
  getRemedy,
  listCasesByRemedy,
  listDistricts,
  listHealersByDistrict,
  photoUrl,
} from "./api";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listDistricts", () => {
  it("returns the parsed list", async () => {
    mockFetchOnce(200, [{ id: 1, provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" }]);
    const got = await listDistricts(1);
    expect(got).toHaveLength(1);
    expect(got[0].nameEnglish).toBe("Kut Chum");
  });
});

describe("getHealer", () => {
  it("returns null on 404", async () => {
    mockFetchOnce(404, { error: "healer not found" });
    expect(await getHealer(999)).toBeNull();
  });

  it("throws on 500", async () => {
    mockFetchOnce(500, { error: "boom" });
    await expect(getHealer(1)).rejects.toThrow();
  });
});

describe("getRemedy", () => {
  it("returns the remedy", async () => {
    mockFetchOnce(200, { id: 5, healerId: 2, name: "ยาต้ม" });
    const got = await getRemedy(5);
    expect(got?.name).toBe("ยาต้ม");
  });
});

describe("listHealersByDistrict / listCasesByRemedy", () => {
  it("parse lists", async () => {
    mockFetchOnce(200, [{ id: 1, districtId: 2, fullName: "หมอ ก" }]);
    expect(await listHealersByDistrict(2)).toHaveLength(1);

    mockFetchOnce(200, [{ id: 1, remedyId: 3, patientAge: 40 }]);
    expect(await listCasesByRemedy(3)).toHaveLength(1);
  });
});

describe("photoUrl", () => {
  it("builds the proxy path", () => {
    expect(photoUrl(7)).toBe("/api/v1/photos/7");
  });
});
