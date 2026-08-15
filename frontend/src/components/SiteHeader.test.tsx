import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { SiteHeader } from "./SiteHeader";

vi.mock("next/navigation", () => ({ usePathname: () => "/th" }));

describe("SiteHeader", () => {
  it("shows a province-neutral brand and a staff link", () => {
    render(
      <I18nProvider locale="th" dict={th}>
        <SiteHeader />
      </I18nProvider>,
    );
    const brand = screen.getByRole("link", { name: /ตำรายาพื้นบ้าน/ });
    expect(brand).toHaveAttribute("href", "/");
    expect(brand.textContent).not.toMatch(/ยโสธร/);
    expect(screen.getByRole("link", { name: /เจ้าหน้าที่/ })).toHaveAttribute("href", "/staff");
  });
});
