import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { getDistrict, getProvince, listHealersByDistrict } from "@/lib/api";

import { DistrictPage } from "./DistrictPage";

vi.mock("@/lib/api", () => ({
  getDistrict: vi.fn(),
  getProvince: vi.fn(),
  listHealersByDistrict: vi.fn(),
}));

describe("DistrictPage", () => {
  it("renders the district title and a locale-prefixed healer card link", async () => {
    vi.mocked(getDistrict).mockResolvedValue({
      id: 10,
      provinceId: 1,
      nameThai: "เมืองยโสธร",
      nameEnglish: "Mueang",
    });
    vi.mocked(getProvince).mockResolvedValue({
      id: 1,
      nameThai: "ยโสธร",
      nameEnglish: "Yasothon",
    });
    vi.mocked(listHealersByDistrict).mockResolvedValue({
      items: [
        {
          id: 2,
          fullName: "หมอทดสอบ",
          districtId: 10,
          specialty: "ไล่ผี",
          subDistrict: "บ้าน",
          biography: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      pageSize: 12,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale="th">
          <MemoryRouter initialEntries={["/th/districts/10"]}>
            <Routes>
              <Route path="/:lang/districts/:districtId" element={<DistrictPage />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    const title = await screen.findByRole("heading", { name: "เมืองยโสธร", level: 1 });
    expect(title).toBeInTheDocument();

    const healerCard = screen.getByRole("link", { name: /หมอทดสอบ/ });
    expect(healerCard).toHaveAttribute("href", "/th/healers/2");

    expect(getDistrict).toHaveBeenCalledWith(10);
    expect(getProvince).toHaveBeenCalledWith(1);
    expect(listHealersByDistrict).toHaveBeenCalledWith(10, { page: 1 });
  });

  it("renders NotFound when the district does not exist", async () => {
    vi.mocked(getDistrict).mockResolvedValue(null);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale="th">
          <MemoryRouter initialEntries={["/th/districts/999"]}>
            <Routes>
              <Route path="/:lang/districts/:districtId" element={<DistrictPage />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
    expect(getDistrict).toHaveBeenCalledWith(999);
  });
});
