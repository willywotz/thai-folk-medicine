import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getHealer,
  getRemedy,
  getTreatmentCase,
  listCasesByRemedy,
  listDistricts,
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
  it("builds a paginated, filtered query and returns a Page", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 2, pageSize: 12, total: 0, totalPages: 1 }), {
        status: 200,
      }),
    );

    const res = await listRemedies({ page: 2, herbId: 3, symptom: "ไข้" });
    const url = spy.mock.calls[0][0] as string;

    expect(url).toContain("/remedies?");
    expect(url).toContain("page=2");
    expect(url).toContain("herbId=3");
    expect(url).toContain("symptom=");
    expect(url).not.toContain("districtId=");
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
