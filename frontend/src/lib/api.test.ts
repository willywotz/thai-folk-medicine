import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDistrict,
  getHealer,
  getProvince,
  getRemedy,
  getStats,
  getTreatmentCase,
  listActivity,
  listCasesByRemedy,
  listDistricts,
  listHealers,
  listHealersByDistrict,
  listRemedies,
  photoUrl,
  search,
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

describe("getDistrict", () => {
  it("returns the district", async () => {
    mockFetchOnce(200, { id: 5, provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" });
    const got = await getDistrict(5);
    expect(got?.nameThai).toBe("กุดชุม");
  });

  it("returns null on 404", async () => {
    mockFetchOnce(404, { error: "district not found" });
    expect(await getDistrict(999)).toBeNull();
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

describe("getTreatmentCase", () => {
  it("returns the case", async () => {
    mockFetchOnce(200, { id: 8, remedyId: 5, patientAge: 40 });
    const got = await getTreatmentCase(8);
    expect(got?.patientAge).toBe(40);
  });

  it("returns null on 404", async () => {
    mockFetchOnce(404, { error: "case not found" });
    expect(await getTreatmentCase(999)).toBeNull();
  });
});

describe("listRemedies", () => {
  it("builds a paginated query and returns a Page", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 2, pageSize: 12, total: 0, totalPages: 1 }), {
        status: 200,
      }),
    );

    const res = await listRemedies({ page: 2 });
    const url = spy.mock.calls[0][0] as string;

    expect(url).toContain("/remedies?");
    expect(url).toContain("page=2");
    expect(res.totalPages).toBe(1);
  });
});

describe("listHealersByDistrict / listCasesByRemedy", () => {
  it("parse pages", async () => {
    mockFetchOnce(200, { items: [{ id: 1, districtId: 2, fullName: "หมอ ก" }], page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect((await listHealersByDistrict(2)).items).toHaveLength(1);

    mockFetchOnce(200, { items: [{ id: 1, remedyId: 3, patientAge: 40 }], page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect((await listCasesByRemedy(3)).items).toHaveLength(1);
  });
});

describe("getProvince", () => {
  it("returns the province", async () => {
    mockFetchOnce(200, { id: 1, nameThai: "ยโสธร", nameEnglish: "Yasothon" });
    const got = await getProvince(1);
    expect(got?.nameEnglish).toBe("Yasothon");
  });

  it("returns null on 404", async () => {
    mockFetchOnce(404, { error: "province not found" });
    expect(await getProvince(999)).toBeNull();
  });
});

describe("listHealers", () => {
  it("omits districtId from the query when unset", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, pageSize: 48, total: 0, totalPages: 1 }), {
        status: 200,
      }),
    );
    await listHealers();
    const url = spy.mock.calls[0][0] as string;
    expect(url).not.toContain("districtId");
  });

  it("includes districtId in the query when set", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, pageSize: 48, total: 0, totalPages: 1 }), {
        status: 200,
      }),
    );
    await listHealers({ districtId: 4 });
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("districtId=4");
  });
});

describe("listActivity", () => {
  it("returns a Page<Activity>", async () => {
    mockFetchOnce(200, {
      items: [{ id: 1, eventName: "healer.created", occurredAt: "2026-08-15T00:00:00Z", payload: {} }],
      page: 1,
      pageSize: 12,
      total: 1,
      totalPages: 1,
    });
    const got = await listActivity();
    expect(got.items[0].eventName).toBe("healer.created");
  });
});

describe("getStats", () => {
  it("returns the aggregate counts", async () => {
    mockFetchOnce(200, { provinces: 1, districts: 2, healers: 3, remedies: 4, cases: 5, herbs: 6 });
    const got = await getStats();
    expect(got).toEqual({ provinces: 1, districts: 2, healers: 3, remedies: 4, cases: 5, herbs: 6 });
  });
});

describe("photoUrl", () => {
  it("builds the proxy path", () => {
    expect(photoUrl(7)).toBe("/api/v1/photos/7");
  });
});

describe("search", () => {
  it("encodes the term, omits undefined params, and returns a Page<SearchHit>", async () => {
    const captured: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        captured.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ type: "remedy", id: 1, title: "ยา", subtitle: "หมอ ก", score: 1 }],
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
          }),
        };
      }) as unknown as typeof fetch,
    );

    const got = await search("ฟ้า ทะลาย");

    const url = new URL(captured[0]);
    expect(url.pathname).toContain("/search");
    expect(url.searchParams.get("searchTerm")).toBe("ฟ้า ทะลาย");
    expect(url.searchParams.has("page")).toBe(false);
    expect(got.items).toHaveLength(1);
    expect(got.items[0].type).toBe("remedy");
  });
});
