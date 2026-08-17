import { afterEach, expect, it, vi } from "vitest";
import { createHealer } from "./staff-queries";

afterEach(() => vi.restoreAllMocks());

it("createHealer POSTs to /api/v1/healers with credentials (not /bff)", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 1, fullName: "Test", districtId: 1, subDistrict: "", specialty: "", biography: "", createdAt: "", updatedAt: "" }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await createHealer({ fullName: "Test", districtId: 1, subDistrict: "", specialty: "", biography: "" } as never).catch(() => {});
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain("/api/v1/healers");
  expect(url).not.toContain("/bff");
  expect(init).toMatchObject({ credentials: "include", method: "POST" });
});
