import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activityKey,
  createCase,
  createDistrict,
  createHealer,
  createHerb,
  createProvince,
  createRemedy,
  deleteDistrict,
  deleteHealer,
  deletePhoto,
  deleteProvince,
  districtListKey,
  fetchActivity,
  fetchCases,
  fetchHealers,
  fetchHerbs,
  fetchPhotos,
  fetchRemedies,
  fetchStats,
  healerListKey,
  photoListKey,
  provinceListKey,
  statsKey,
  updateDistrict,
  updateProvince,
  uploadPhoto,
} from "./staff-queries";

function mockOk(body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

/** page wraps items in the Plan 11 pagination envelope the API returns. */
function page<T>(items: T[]) {
  return { items, page: 1, pageSize: 48, total: items.length, totalPages: 1 };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("healerListKey", () => {
  it("is a wildcard prefix when called with no args", () => {
    expect(healerListKey()).toEqual(["healers"]);
  });

  it("namespaces by page and search term", () => {
    expect(healerListKey(2, "ก")).toEqual(["healers", 2, "ก"]);
  });
});

describe("fetchHealers", () => {
  it("reads a page of the flat healer list and returns the full envelope", async () => {
    const fetchMock = mockOk(page([{ id: 1 }]));
    const got = await fetchHealers();
    expect(got.items).toHaveLength(1);
    expect(got.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/healers?page=1&pageSize=20", expect.anything());
  });

  it("threads page and searchTerm through", async () => {
    const fetchMock = mockOk(page([{ id: 1 }]));
    await fetchHealers({ page: 2, searchTerm: "ก" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/healers?page=2&pageSize=20&searchTerm=%E0%B8%81",
      expect.anything(),
    );
  });
});

describe("fetchRemedies", () => {
  it("returns the full envelope, scoped to a healer", async () => {
    const fetchMock = mockOk(page([{ id: 2 }]));
    const got = await fetchRemedies({ healerId: 5 });
    expect(got.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/healers/5/remedies?page=1&pageSize=20",
      expect.anything(),
    );
  });
});

describe("fetchCases", () => {
  it("returns the full envelope, scoped to a remedy", async () => {
    const fetchMock = mockOk(page([{ id: 3 }]));
    const got = await fetchCases({ remedyId: 7, page: 2 });
    expect(got.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/remedies/7/treatment-cases?page=2&pageSize=20",
      expect.anything(),
    );
  });
});

describe("fetchHerbs", () => {
  it("returns the full envelope", async () => {
    const fetchMock = mockOk(page([{ id: 4 }]));
    const got = await fetchHerbs();
    expect(got.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/herbs?page=1&pageSize=20", expect.anything());
  });
});

describe("createHealer", () => {
  it("POSTs a new healer and resolves to the created entity", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9, fullName: "หมอสมชาย" }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await createHealer({
      districtId: 4,
      fullName: "หมอสมชาย",
      subDistrict: "",
      specialty: "",
      biography: "",
    });
    expect(got).toEqual({ id: 9, fullName: "หมอสมชาย" });
  });
});

describe("createRemedy", () => {
  it("POSTs a new remedy and resolves to the created entity", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 10, name: "ยาต้ม" }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await createRemedy({
      healerId: 2,
      name: "ยาต้ม",
      symptoms: "",
      preparationMethod: "",
      usage: "",
      note: "",
      herbs: [],
    });
    expect(got).toEqual({ id: 10, name: "ยาต้ม" });
  });
});

describe("createCase", () => {
  it("POSTs a new case and resolves to the created entity", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 11, patientSex: "female" }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await createCase({
      remedyId: 5,
      healerId: 2,
      patientAge: 40,
      patientSex: "female",
      symptoms: "",
      result: "",
      note: "",
      treatedOn: "2026-03-01",
    });
    expect(got).toEqual({ id: 11, patientSex: "female" });
  });
});

describe("createHerb", () => {
  it("POSTs a new herb and resolves to the created entity", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 12, nameThai: "ขิง" }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await createHerb({
      nameThai: "ขิง",
      nameEnglish: "",
      scientificName: "",
      properties: "",
      description: "",
    });
    expect(got).toEqual({ id: 12, nameThai: "ขิง" });
  });
});

describe("deleteHealer", () => {
  it("DELETEs through the bff and throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409 })) as unknown as typeof fetch);
    await expect(deleteHealer(1)).rejects.toThrow();
  });
});

describe("photoListKey", () => {
  it("namespaces by owner", () => {
    expect(photoListKey("healer", 2)).toEqual(["photos", "healer", 2]);
  });
});

describe("fetchPhotos", () => {
  it("reads the list endpoint with owner query", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ id: 1 }] }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await fetchPhotos("healer", 2);
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/photos?ownerType=healer&ownerId=2", expect.anything());
  });
});

describe("uploadPhoto", () => {
  it("posts multipart form data to the bff", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 9 }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const file = new File(["bytes"], "p.jpg", { type: "image/jpeg" });
    await uploadPhoto({ ownerType: "healer", ownerId: 2, file, caption: "c" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/photos");
    expect((init as { method: string }).method).toBe("POST");
    expect((init as { body: unknown }).body).toBeInstanceOf(FormData);
  });
});

describe("deletePhoto", () => {
  it("throws when the bff delete fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch);
    await expect(deletePhoto(1)).rejects.toThrow();
  });
});

describe("activityKey / statsKey", () => {
  it("are stable query keys", () => {
    expect(activityKey).toEqual(["activity"]);
    expect(statsKey).toEqual(["stats"]);
  });
});

describe("fetchActivity", () => {
  it("unwraps the pagination envelope from the authenticated bff feed", async () => {
    const fetchMock = mockOk(page([{ id: 1, eventName: "healer.created" }]));
    const got = await fetchActivity();
    expect(got).toHaveLength(1);
    expect(got[0].eventName).toBe("healer.created");
    expect(fetchMock).toHaveBeenCalledWith("/bff/activity?pageSize=48", expect.anything());
  });
});

describe("fetchStats", () => {
  it("returns the aggregate counts from the authenticated bff endpoint", async () => {
    const fetchMock = mockOk({ provinces: 1, districts: 2, healers: 3, remedies: 4, cases: 5, herbs: 6 });
    const got = await fetchStats();
    expect(got).toEqual({ provinces: 1, districts: 2, healers: 3, remedies: 4, cases: 5, herbs: 6 });
    expect(fetchMock).toHaveBeenCalledWith("/bff/stats", expect.anything());
  });
});

describe("provinceListKey / districtListKey", () => {
  it("are stable query keys", () => {
    expect(provinceListKey).toEqual(["provinces"]);
    expect(districtListKey(5)).toEqual(["districts", 5]);
  });
});

describe("createProvince / updateProvince / deleteProvince", () => {
  it("POSTs a new province through the bff and resolves to the created entity", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 9, nameThai: "ยโสธร", nameEnglish: "Yasothon" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await createProvince({ nameThai: "ยโสธร", nameEnglish: "Yasothon" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/provinces");
    expect((init as { method: string }).method).toBe("POST");
    expect(got).toEqual({ id: 9, nameThai: "ยโสธร", nameEnglish: "Yasothon" });
  });

  it("PUTs changes through the bff", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await updateProvince(5, { nameThai: "ยโสธร", nameEnglish: "Yasothon" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/provinces/5");
    expect((init as { method: string }).method).toBe("PUT");
  });

  it("throws when the bff delete fails (referenced province)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409 })) as unknown as typeof fetch);
    await expect(deleteProvince(5)).rejects.toThrow();
  });
});

describe("createDistrict / updateDistrict / deleteDistrict", () => {
  it("POSTs a new district (with provinceId) through the bff and resolves to the created entity", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 9, provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await createDistrict({ provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/districts");
    expect((init as { method: string }).method).toBe("POST");
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      provinceId: 1,
      nameThai: "กุดชุม",
      nameEnglish: "Kut Chum",
    });
    expect(got).toEqual({ id: 9, provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" });
  });

  it("PUTs changes through the bff", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await updateDistrict(3, { nameThai: "กุดชุม", nameEnglish: "Kut Chum" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/districts/3");
    expect((init as { method: string }).method).toBe("PUT");
  });

  it("throws when the bff delete fails (referenced district)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409 })) as unknown as typeof fetch);
    await expect(deleteDistrict(3)).rejects.toThrow();
  });
});
