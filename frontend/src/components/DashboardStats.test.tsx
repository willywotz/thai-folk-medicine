import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { DashboardStats } from "./DashboardStats";

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

describe("DashboardStats", () => {
  it("renders a tile with its count for each stat", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ provinces: 1, districts: 2, healers: 3, remedies: 4, cases: 5, herbs: 6 }),
      })) as unknown as typeof fetch,
    );
    renderWithClient(<DashboardStats />);
    expect(await screen.findByText("จังหวัด")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("สมุนไพร")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});
