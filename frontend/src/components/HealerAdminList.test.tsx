import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealerAdminList } from "./HealerAdminList";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HealerAdminList", () => {
  it("lists healers with edit and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ items: [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }], page: 1, pageSize: 48, total: 1, totalPages: 1 }) })) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districtId={3} />);
    expect(await screen.findByText("หมอ ก")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/districts/3/healers/1/edit",
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
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
        return { ok: true, json: async () => ({ items: list, page: 1, pageSize: 48, total: list.length, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districtId={3} />);
    await screen.findByText("หมอ ก");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText("หมอ ก")).toBeNull());
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return { ok: true, json: async () => ({ items: [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }], page: 1, pageSize: 48, total: 1, totalPages: 1 }) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districtId={3} />);
    await screen.findByText("หมอ ก");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(
      await screen.findByText("Could not delete this healer. It may still have remedies or cases."),
    ).toBeInTheDocument();
    expect(screen.getByText("หมอ ก")).toBeInTheDocument();
  });
});
