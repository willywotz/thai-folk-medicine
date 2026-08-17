import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { StaffLayout } from "./StaffLayout";

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        path: "/:lang/staff",
        element: (
          <I18nProvider locale="th">
            <StaffLayout />
          </I18nProvider>
        ),
        children: [{ index: true, element: <div>page</div> }],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("StaffLayout", () => {
  it("renders the 6 nav links with locale-prefixed hrefs", () => {
    renderAt("/th/staff");
    const expected = [
      { label: th.staff.nav.dashboard, href: "/th/staff" },
      { label: th.staff.nav.province, href: "/th/staff/provinces" },
      { label: th.staff.nav.healer, href: "/th/staff/healers" },
      { label: th.staff.nav.remedy, href: "/th/staff/remedies" },
      { label: th.staff.nav.case, href: "/th/staff/cases" },
      { label: th.staff.nav.herb, href: "/th/staff/herbs" },
    ];
    for (const { label, href } of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("renders a logout button", () => {
    renderAt("/th/staff");
    expect(screen.getByRole("button", { name: th.staff.logout })).toBeInTheDocument();
  });

  it("renders the outlet child content", () => {
    renderAt("/th/staff");
    expect(screen.getByText("page")).toBeInTheDocument();
  });
});
