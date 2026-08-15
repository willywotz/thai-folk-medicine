import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StaffNavLink } from "./StaffNavLink";

const pathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

describe("StaffNavLink", () => {
  it("marks the link as current on an exact path match", () => {
    pathname.mockReturnValue("/staff/herbs");
    render(
      <StaffNavLink href="/staff/herbs" match={["/staff/herbs"]}>
        Herbs
      </StaffNavLink>,
    );
    expect(screen.getByRole("link", { name: "Herbs" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the link as current on a nested-prefix match", () => {
    pathname.mockReturnValue("/staff/districts/3");
    render(
      <StaffNavLink href="/staff" match={["/staff/districts", "/staff/healers"]}>
        Districts
      </StaffNavLink>,
    );
    expect(screen.getByRole("link", { name: "Districts" })).toHaveAttribute("aria-current", "page");
  });

  it("is not current when no match applies", () => {
    pathname.mockReturnValue("/staff/herbs");
    render(
      <StaffNavLink href="/staff" match={["/staff/districts", "/staff/healers"]}>
        Districts
      </StaffNavLink>,
    );
    expect(screen.getByRole("link", { name: "Districts" })).not.toHaveAttribute("aria-current");
  });

  it("marks a section link as current on a nested detail route", () => {
    pathname.mockReturnValue("/staff/remedies/new");
    render(
      <StaffNavLink href="/staff/remedies" match={["/staff/remedies"]}>
        Remedy
      </StaffNavLink>,
    );
    expect(screen.getByRole("link", { name: "Remedy" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the exact-only Dashboard link inactive on other sections", () => {
    pathname.mockReturnValue("/staff/healers");
    render(
      <StaffNavLink href="/staff" match={[]}>
        Dashboard
      </StaffNavLink>,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("marks the exact-only Dashboard link current on its own path", () => {
    pathname.mockReturnValue("/staff");
    render(
      <StaffNavLink href="/staff" match={[]}>
        Dashboard
      </StaffNavLink>,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });
});
