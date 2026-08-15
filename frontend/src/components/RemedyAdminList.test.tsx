import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemedyAdminList } from "./RemedyAdminList";

const healers = [
  { id: 2, fullName: "หมอสมชาย" },
  { id: 3, fullName: "หมอสมหญิง" },
];

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RemedyAdminList", () => {
  it("lists remedies with the healer name, edit, and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [{ id: 5, healerId: 2, name: "ยาต้ม" }], page: 1, pageSize: 20, total: 1, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healers={healers} />);
    const row = (await screen.findByText("ยาต้ม")).closest("li")!;
    expect(within(row).getByText("หมอสมชาย")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /cases/i })).toHaveAttribute(
      "href",
      "/staff/remedies/5/treatment-cases",
    );
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/remedies/5/edit",
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("fetches page 1 without a healer filter or search term", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healers={healers} />);
    await waitFor(() => expect(calls).toContain("/api/v1/remedies?page=1&pageSize=20"));
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return { ok: true, json: async () => ({ items: [{ id: 5, healerId: 2, name: "ยาต้ม" }], page: 1, pageSize: 20, total: 1, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healers={healers} />);
    await screen.findByText("ยาต้ม");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(screen.getByText("ยาต้ม")).toBeInTheDocument();
  });

  it("shows the empty state when there are no remedies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healers={healers} />);
    expect(await screen.findByText(/no remedies/i)).toBeInTheDocument();
  });

  it("scoped to a healer: fetches that healer's remedies, hides the healer column, and links + New to the healer", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({ items: [{ id: 5, healerId: 2, name: "ยาต้ม" }], page: 1, pageSize: 20, total: 1, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healers={healers} healerId={2} />);
    const row = (await screen.findByText("ยาต้ม")).closest("li")!;
    expect(within(row).queryByText("หมอสมชาย")).not.toBeInTheDocument();
    expect(calls).toContain("/api/v1/healers/2/remedies?page=1&pageSize=20");
    expect(screen.getByRole("link", { name: /new remedy/i })).toHaveAttribute(
      "href",
      "/staff/remedies/new?healerId=2",
    );
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
    renderWithClient(<RemedyAdminList healers={healers} />);
    const input = await screen.findByPlaceholderText("Search remedies…");
    await waitFor(() => expect(calls).toContain("/api/v1/remedies?page=1&pageSize=20"));
    await userEvent.type(input, "ยา");
    await waitFor(
      () => expect(calls.at(-1)).toBe(`/api/v1/remedies?page=1&pageSize=20&searchTerm=${encodeURIComponent("ยา")}`),
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
            items: [{ id: 5, healerId: 2, name: "ยาต้ม" }],
            page: 1,
            pageSize: 20,
            total: 30,
            totalPages: 2,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healers={healers} />);
    await screen.findByText("ยาต้ม");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(calls).toContain("/api/v1/remedies?page=2&pageSize=20"));
  });
});
