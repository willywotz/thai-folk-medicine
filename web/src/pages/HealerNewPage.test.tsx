import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HealerNewPage } from "./HealerNewPage";

vi.mock("@/lib/api", () => ({
  getFirstProvince: vi.fn(),
  listDistricts: vi.fn(),
}));

vi.mock("@/components/HealerForm", () => ({
  HealerForm: (props: { healer?: unknown; districtOptions: { value: number; label: string }[] }) => (
    <div
      data-testid="healer-form"
      data-healer={props.healer === undefined ? "absent" : "present"}
      data-options={JSON.stringify(props.districtOptions)}
    />
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
            <Route path="/:lang/staff/healers/new" element={<HealerNewPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HealerNewPage", () => {
  it("fetches districts and wires HealerForm with districtOptions", async () => {
    vi.mocked(getFirstProvince).mockResolvedValue({ id: 1, nameThai: "เชียงใหม่", nameEnglish: "Chiang Mai" });
    vi.mocked(listDistricts).mockResolvedValue([
      { id: 10, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" },
    ]);

    renderAt("/th/staff/healers/new");

    const form = await screen.findByTestId("healer-form");
    expect(form).toHaveAttribute("data-healer", "absent");
    expect(form).toHaveAttribute(
      "data-options",
      JSON.stringify([{ value: 10, label: "Mueang · เมือง" }]),
    );
    expect(screen.getByRole("heading", { level: 1, name: th.staff.addHealerTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: th.staff.headers.healers })).toHaveAttribute(
      "href",
      "/th/staff/healers",
    );
  });

  it("passes empty districtOptions when there is no province", async () => {
    vi.mocked(getFirstProvince).mockResolvedValue(null);

    renderAt("/th/staff/healers/new");

    const form = await screen.findByTestId("healer-form");
    expect(form).toHaveAttribute("data-options", JSON.stringify([]));
  });
});
