import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityFeed } from "./ActivityFeed";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ActivityFeed", () => {
  it("renders a formatted line for each activity entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 1,
              eventName: "remedy.created",
              occurredAt: "2026-08-01T10:00:00Z",
              payload: { Name: "ยาแก้ไข้" },
            },
          ],
          page: 1,
          pageSize: 48,
          total: 1,
          totalPages: 1,
        }),
      })) as unknown as typeof fetch,
    );
    renderWithClient(<ActivityFeed />);
    expect(await screen.findByText("ยาแก้ไข้ added · 2026-08-01")).toBeInTheDocument();
  });
});
