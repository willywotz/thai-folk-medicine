import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { HealerAdminList } from "./HealerAdminList";

const districts = [
  { id: 3, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" },
  { id: 4, provinceId: 1, nameThai: "แม่ริม", nameEnglish: "Mae Rim" },
];

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HealerAdminList", () => {
  it("lists healers with district, edit, and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }], page: 1, pageSize: 20, total: 1, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districts={districts} />);
    const row = (await screen.findByText("หมอ ก")).closest("li")!;
    expect(within(row).getByText(/Mueang/)).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /remedies/i })).toHaveAttribute(
      "href",
      "/staff/healers/1/remedies",
    );
    expect(screen.getByRole("link", { name: "แก้ไข หมอ ก" })).toHaveAttribute(
      "href",
      "/staff/healers/1/edit",
    );
    expect(screen.getByRole("button", { name: "ลบ หมอ ก" })).toBeInTheDocument();
  });

  it("fetches page 1 without a search term", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districts={districts} />);
    await waitFor(() => expect(calls).toContain("/api/v1/healers?page=1&pageSize=20"));
  });

  it("removes a healer after delete", async () => {
    let deleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") {
          deleted = true;
          return { ok: true, status: 204 };
        }
        const list = deleted ? [] : [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }];
        return { ok: true, json: async () => ({ items: list, page: 1, pageSize: 20, total: list.length, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districts={districts} />);
    await screen.findByText("หมอ ก");
    await userEvent.click(screen.getByRole("button", { name: "ลบ หมอ ก" }));
    await waitFor(() => expect(screen.queryByText("หมอ ก")).toBeNull());
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return { ok: true, json: async () => ({ items: [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }], page: 1, pageSize: 20, total: 1, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districts={districts} />);
    await screen.findByText("หมอ ก");
    await userEvent.click(screen.getByRole("button", { name: "ลบ หมอ ก" }));
    expect(
      await screen.findByText("ลบหมอพื้นบ้านไม่สำเร็จ อาจยังมีตำรับยาหรือเคสอยู่"),
    ).toBeInTheDocument();
    expect(screen.getByText("หมอ ก")).toBeInTheDocument();
  });

  it("sends a debounced search term and resets to page 1", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districts={districts} />);
    const input = await screen.findByPlaceholderText("ค้นหาหมอพื้นบ้าน…");
    await waitFor(() => expect(calls).toContain("/api/v1/healers?page=1&pageSize=20"));
    await userEvent.type(input, "หมอ");
    await waitFor(
      () => expect(calls.at(-1)).toBe(`/api/v1/healers?page=1&pageSize=20&searchTerm=${encodeURIComponent("หมอ")}`),
      { timeout: 2000 },
    );
  });

  it("paginates: clicking Next requests page 2", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          json: async () => ({
            items: [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }],
            page: 1,
            pageSize: 20,
            total: 30,
            totalPages: 2,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districts={districts} />);
    await screen.findByText("หมอ ก");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(calls).toContain("/api/v1/healers?page=2&pageSize=20"));
  });
});
