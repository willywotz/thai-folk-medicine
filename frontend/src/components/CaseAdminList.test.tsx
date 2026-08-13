import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseAdminList } from "./CaseAdminList";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CaseAdminList", () => {
  it("lists cases with an edit link and a date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
        ],
      })) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedyId={5} />);
    expect(await screen.findByText(/1 March 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/remedies/5/treatment-cases/8/edit",
    );
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return {
          ok: true,
          json: async () => [
            { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
          ],
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedyId={5} />);
    await screen.findByText(/1 March 2026/i);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(screen.getByText(/1 March 2026/i)).toBeInTheDocument();
  });
});
