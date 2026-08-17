import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

vi.mock("@/lib/api", () => ({
  getFirstProvince: vi.fn(async () => ({
    id: 1,
    nameThai: "ยโสธร",
    nameEnglish: "Yasothon",
  })),
}));

vi.mock("@/components/DashboardStats", () => ({
  DashboardStats: () => <div data-testid="dashboard-stats" />,
}));
vi.mock("@/components/ActivityFeed", () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

import { StaffDashboardPage } from "./StaffDashboardPage";

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/:lang/staff",
        element: (
          <QueryClientProvider client={queryClient}>
            <I18nProvider locale="th">
              <StaffDashboardPage />
            </I18nProvider>
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe("StaffDashboardPage", () => {
  it("renders the header title and dashboard components", async () => {
    renderAt("/th/staff");
    expect(await screen.findByRole("heading", { name: th.staff.nav.dashboard, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-stats")).toBeInTheDocument();
    expect(screen.getByTestId("activity-feed")).toBeInTheDocument();
  });
});
