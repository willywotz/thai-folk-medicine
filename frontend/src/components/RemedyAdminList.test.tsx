import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemedyAdminList } from "./RemedyAdminList";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RemedyAdminList", () => {
  it("lists remedies with edit, cases, and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [{ id: 5, healerId: 2, name: "ยาต้ม" }], page: 1, pageSize: 48, total: 1, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healerId={2} />);
    expect(await screen.findByText("ยาต้ม")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/healers/2/remedies/5/edit",
    );
    expect(screen.getByRole("link", { name: /cases/i })).toHaveAttribute(
      "href",
      "/staff/remedies/5/treatment-cases",
    );
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return { ok: true, json: async () => ({ items: [{ id: 5, healerId: 2, name: "ยาต้ม" }], page: 1, pageSize: 48, total: 1, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healerId={2} />);
    await screen.findByText("ยาต้ม");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(screen.getByText("ยาต้ม")).toBeInTheDocument();
  });
});
