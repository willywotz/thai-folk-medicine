import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("shows a province-neutral brand and a staff link", () => {
    render(<SiteHeader />);
    const brand = screen.getByRole("link", { name: /ตำรายาพื้นบ้าน/ });
    expect(brand).toHaveAttribute("href", "/");
    expect(brand.textContent).not.toMatch(/ยโสธร/);
    expect(screen.getByRole("link", { name: /เจ้าหน้าที่/ })).toHaveAttribute("href", "/staff");
  });
});
