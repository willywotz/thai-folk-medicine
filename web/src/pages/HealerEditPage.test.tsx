import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HealerEditPage } from "./HealerEditPage";

vi.mock("@/lib/api", () => ({
  getFirstProvince: vi.fn(),
  listDistricts: vi.fn(),
  getHealer: vi.fn(),
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

const { getFirstProvince, listDistricts, getHealer } = await import("@/lib/api");

const HEALER = {
  id: 2,
  districtId: 10,
  fullName: "หมอทดสอบ",
  subDistrict: "บ้าน",
  specialty: "ไล่ผี",
  biography: "ประวัติ",
  createdAt: "",
  updatedAt: "",
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/staff/healers/:healerId/edit" element={<HealerEditPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HealerEditPage", () => {
  it("fetches healer + districts and wires HealerForm with healer and districtOptions", async () => {
    vi.mocked(getHealer).mockResolvedValue(HEALER);
    vi.mocked(getFirstProvince).mockResolvedValue({ id: 1, nameThai: "เชียงใหม่", nameEnglish: "Chiang Mai" });
    vi.mocked(listDistricts).mockResolvedValue([
      { id: 10, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" },
    ]);

    renderAt("/th/staff/healers/2/edit");

    const form = await screen.findByTestId("healer-form");
    expect(form).toHaveAttribute("data-healer", "present");
    expect(form).toHaveAttribute(
      "data-options",
      JSON.stringify([{ value: 10, label: "Mueang · เมือง" }]),
    );
    expect(screen.getByRole("heading", { level: 1, name: th.staff.editName(HEALER.fullName) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: th.staff.headers.healers })).toHaveAttribute(
      "href",
      "/th/staff/healers",
    );
  });

  it("renders NotFound when the healer does not exist", async () => {
    vi.mocked(getHealer).mockResolvedValue(null);

    renderAt("/th/staff/healers/99/edit");

    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});
