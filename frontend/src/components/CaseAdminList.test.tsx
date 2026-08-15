import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseAdminList } from "./CaseAdminList";

const remedies = [
  { id: 5, name: "ยาต้ม", healerId: 2 },
  { id: 6, name: "ยาพอก", healerId: 3 },
];

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CaseAdminList", () => {
  it("lists cases with the remedy name, edit link, and a date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [
            { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
          ],
          page: 1, pageSize: 20, total: 1, totalPages: 1,
        }),
      })) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedies={remedies} />);
    const row = (await screen.findByText(/1 March 2026/i)).closest("li")!;
    expect(within(row).getByText("ยาต้ม")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/cases/8/edit",
    );
  });

  it("filters cases by the selected remedy", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedies={remedies} />);
    await waitFor(() => expect(calls).toContain("/api/v1/treatment-cases?page=1&pageSize=20"));
    await userEvent.selectOptions(await screen.findByLabelText(/^remedy/i), "5");
    await waitFor(() => expect(calls.at(-1)).toBe("/api/v1/remedies/5/treatment-cases?page=1&pageSize=20"));
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return {
          ok: true,
          json: async () => ({
            items: [
              { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
            ],
            page: 1, pageSize: 20, total: 1, totalPages: 1,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedies={remedies} />);
    await screen.findByText(/1 March 2026/i);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(screen.getByText(/1 March 2026/i)).toBeInTheDocument();
  });

  it("shows the empty state when there are no cases", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedies={remedies} />);
    expect(await screen.findByText(/no treatment cases/i)).toBeInTheDocument();
  });

  it("scoped to a remedy: fetches that remedy's cases, hides the remedy column, and links + New to the remedy", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          json: async () => ({
            items: [
              { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
            ],
            page: 1, pageSize: 20, total: 1, totalPages: 1,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedies={remedies} remedyId={5} />);
    const row = (await screen.findByText(/1 March 2026/i)).closest("li")!;
    expect(within(row).queryByText("ยาต้ม")).not.toBeInTheDocument();
    expect(calls).toContain("/api/v1/remedies/5/treatment-cases?page=1&pageSize=20");
    expect(screen.getByRole("link", { name: /new treatment case/i })).toHaveAttribute(
      "href",
      "/staff/cases/new?remedyId=5",
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
            items: [
              { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
            ],
            page: 1, pageSize: 20, total: 30, totalPages: 2,
          }),
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedies={remedies} />);
    await screen.findByText(/1 March 2026/i);
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(calls).toContain("/api/v1/treatment-cases?page=2&pageSize=20"));
  });
});
