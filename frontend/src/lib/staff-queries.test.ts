import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activityKey,
  createDistrict,
  createProvince,
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
  it("namespaces by district", () => {
    expect(healerListKey(3)).toEqual(["healers", 3]);
  });
});

describe("fetchHealers", () => {
  it("reads the flat healer list and unwraps the pagination envelope", async () => {
    const fetchMock = mockOk(page([{ id: 1 }]));
    const got = await fetchHealers();
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/healers?pageSize=48", expect.anything());
  });

  it("filters by district when given", async () => {
    const fetchMock = mockOk(page([{ id: 1 }]));
    await fetchHealers(3);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/healers?districtId=3&pageSize=48",
      expect.anything(),
    );
  });
});

describe("fetchRemedies", () => {
  it("unwraps the pagination envelope", async () => {
    const fetchMock = mockOk(page([{ id: 2 }]));
    const got = await fetchRemedies(5);
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/healers/5/remedies?pageSize=48",
      expect.anything(),
    );
  });
});

describe("fetchCases", () => {
  it("unwraps the pagination envelope", async () => {
    const fetchMock = mockOk(page([{ id: 3 }]));
    const got = await fetchCases(7);
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/remedies/7/treatment-cases?pageSize=48",
      expect.anything(),
    );
  });
});

describe("fetchHerbs", () => {
  it("unwraps the pagination envelope", async () => {
    const fetchMock = mockOk(page([{ id: 4 }]));
    const got = await fetchHerbs();
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/herbs?pageSize=48", expect.anything());
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
  it("POSTs a new province through the bff", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await createProvince({ nameThai: "ยโสธร", nameEnglish: "Yasothon" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/provinces");
    expect((init as { method: string }).method).toBe("POST");
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
  it("POSTs a new district (with provinceId) through the bff", async () => {
    const fetchMock = vi.fn<(url?: string, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await createDistrict({ provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/districts");
    expect((init as { method: string }).method).toBe("POST");
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      provinceId: 1,
      nameThai: "กุดชุม",
      nameEnglish: "Kut Chum",
    });
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
