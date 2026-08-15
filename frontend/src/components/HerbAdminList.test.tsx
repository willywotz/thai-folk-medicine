import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HerbAdminList } from "./HerbAdminList";

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

describe("HerbAdminList", () => {
  it("lists herbs with edit, delete, and used-in controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [{ id: 9, nameThai: "ขิง", nameEnglish: "Ginger" }],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        }),
      })) as unknown as typeof fetch,
    );
    renderWithClient(<HerbAdminList />);
    const row = (await screen.findByText("ขิง")).closest("li")!;
    expect(within(row).getByText("Ginger")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: th.staff.link.usedIn })).toHaveAttribute("href", "/staff/herbs/9");
    expect(screen.getByRole("link", { name: "แก้ไข ขิง" })).toHaveAttribute("href", "/staff/herbs/9/edit");
    expect(screen.getByRole("button", { name: "ลบ ขิง" })).toBeInTheDocument();
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
    renderWithClient(<HerbAdminList />);
    await waitFor(() => expect(calls).toContain("/api/v1/herbs?page=1&pageSize=20"));
  });

  it("shows the empty state when there are no herbs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<HerbAdminList />);
    expect(await screen.findByText("ยังไม่มีสมุนไพร")).toBeInTheDocument();
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return {
          ok: true,
          json: async () => ({
            items: [{ id: 9, nameThai: "ขิง", nameEnglish: "Ginger" }],
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HerbAdminList />);
    await screen.findByText("ขิง");
    await userEvent.click(screen.getByRole("button", { name: "ลบ ขิง" }));
    expect(await screen.findByText("ลบไม่สำเร็จ สมุนไพรนี้อาจยังถูกใช้ในตำรับยา")).toBeInTheDocument();
    expect(screen.getByText("ขิง")).toBeInTheDocument();
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
    renderWithClient(<HerbAdminList />);
    const input = await screen.findByPlaceholderText("ค้นหาสมุนไพร…");
    await waitFor(() => expect(calls).toContain("/api/v1/herbs?page=1&pageSize=20"));
    await userEvent.type(input, "ขิง");
    await waitFor(
      () => expect(calls.at(-1)).toBe(`/api/v1/herbs?page=1&pageSize=20&searchTerm=${encodeURIComponent("ขิง")}`),
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
            items: [{ id: 9, nameThai: "ขิง", nameEnglish: "Ginger" }],
            page: 1,
            pageSize: 20,
            total: 30,
            totalPages: 2,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HerbAdminList />);
    await screen.findByText("ขิง");
    await userEvent.click(screen.getByRole("button", { name: th.common.next }));
    await waitFor(() => expect(calls).toContain("/api/v1/herbs?page=2&pageSize=20"));
  });
});
