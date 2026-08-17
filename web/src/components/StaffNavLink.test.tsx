import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { I18nProvider } from "@/components/I18nProvider";

import { StaffNavLink } from "./StaffNavLink";

describe("StaffNavLink", () => {
  it("marks the link as current on an exact path match", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/staff/herbs",
          element: (
            <I18nProvider locale="th">
              <StaffNavLink href="/staff/herbs" match={["/staff/herbs"]}>
                Herbs
              </StaffNavLink>
            </I18nProvider>
          ),
        },
      ],
      { initialEntries: ["/staff/herbs"] },
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByRole("link", { name: "Herbs" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the link as current on a nested-prefix match", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/staff/districts/:id",
          element: (
            <I18nProvider locale="th">
              <StaffNavLink href="/staff" match={["/staff/districts", "/staff/healers"]}>
                Districts
              </StaffNavLink>
            </I18nProvider>
          ),
        },
      ],
      { initialEntries: ["/staff/districts/3"] },
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByRole("link", { name: "Districts" })).toHaveAttribute("aria-current", "page");
  });

  it("is not current when no match applies", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/staff/herbs",
          element: (
            <I18nProvider locale="th">
              <StaffNavLink href="/staff" match={["/staff/districts", "/staff/healers"]}>
                Districts
              </StaffNavLink>
            </I18nProvider>
          ),
        },
      ],
      { initialEntries: ["/staff/herbs"] },
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByRole("link", { name: "Districts" })).not.toHaveAttribute("aria-current");
  });
});
