import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HealersPage } from "./HealersPage";

vi.mock("@/lib/api", () => ({
  getFirstProvince: vi.fn(),
  listDistricts: vi.fn(),
}));

vi.mock("@/components/HealerAdminList", () => ({
  HealerAdminList: (props: { districts: unknown[] }) => (
    <div data-testid="healer-admin-list" data-districts={JSON.stringify(props.districts)} />
  ),
}));

const { getFirstProvince, listDistricts } = await import("@/lib/api");

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/staff/healers" element={<HealersPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HealersPage", () => {
  it("fetches first province + districts and wires HealerAdminList", async () => {
    vi.mocked(getFirstProvince).mockResolvedValue({ id: 1, nameThai: "เชียงใหม่", nameEnglish: "Chiang Mai" });
    vi.mocked(listDistricts).mockResolvedValue([
      { id: 10, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" },
    ]);

    renderAt("/th/staff/healers");

    const list = await screen.findByTestId("healer-admin-list");
    expect(list).toHaveAttribute(
      "data-districts",
      JSON.stringify([{ id: 10, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" }]),
    );
    expect(screen.getByRole("heading", { level: 1, name: th.staff.headers.healers })).toBeInTheDocument();
    // locale-prefixed breadcrumb to staff dashboard
    expect(screen.getByRole("link", { name: th.staff.nav.dashboard })).toHaveAttribute("href", "/th/staff");
  });

  it("passes empty districts when there is no province", async () => {
    vi.mocked(getFirstProvince).mockResolvedValue(null);

    renderAt("/th/staff/healers");

    const list = await screen.findByTestId("healer-admin-list");
    expect(list).toHaveAttribute("data-districts", JSON.stringify([]));
  });
});
