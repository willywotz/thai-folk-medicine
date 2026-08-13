import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
});
