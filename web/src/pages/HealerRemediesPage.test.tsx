import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HealerRemediesPage } from "./HealerRemediesPage";

vi.mock("@/lib/api", () => ({
  getHealer: vi.fn(),
  listHealers: vi.fn(),
}));

vi.mock("@/components/RemedyAdminList", () => ({
  RemedyAdminList: (props: { healers: { id: number; fullName: string }[]; healerId?: number }) => (
    <div
      data-testid="remedy-admin-list"
      data-healers={JSON.stringify(props.healers)}
      data-healer-id={props.healerId === undefined ? "absent" : String(props.healerId)}
    />
  ),
}));

const { getHealer, listHealers } = await import("@/lib/api");

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
            <Route path="/:lang/staff/healers/:healerId/remedies" element={<HealerRemediesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HealerRemediesPage", () => {
  it("fetches healer + all healers and wires RemedyAdminList with healers and healerId", async () => {
    vi.mocked(getHealer).mockResolvedValue(HEALER);
    vi.mocked(listHealers).mockResolvedValue({
      items: [HEALER],
      page: 1,
      pageSize: 48,
      total: 1,
      totalPages: 1,
    });

    renderAt("/th/staff/healers/2/remedies");

    const list = await screen.findByTestId("remedy-admin-list");
    expect(list).toHaveAttribute("data-healers", JSON.stringify([HEALER]));
    expect(list).toHaveAttribute("data-healer-id", "2");
    expect(screen.getByRole("heading", { level: 1, name: th.staff.headers.healerRemedies })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: th.staff.headers.healers })).toHaveAttribute(
      "href",
      "/th/staff/healers",
    );
  });

  it("renders NotFound when the healer does not exist", async () => {
    vi.mocked(getHealer).mockResolvedValue(null);

    renderAt("/th/staff/healers/99/remedies");

    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});
