import { afterEach, expect, it, vi } from "vitest";
import { apiGet } from "./api";

afterEach(() => vi.restoreAllMocks());

it("apiGet requests /api/v1 with credentials and returns json", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const data = await apiGet<{ ok: boolean }>("/remedies");
  expect(data.ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/remedies", expect.objectContaining({ credentials: "include" }));
});

it("apiGet throws on non-2xx", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
  await expect(apiGet("/authentication/session")).rejects.toThrow();
});
