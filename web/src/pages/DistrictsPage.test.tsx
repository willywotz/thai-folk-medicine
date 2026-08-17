import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { getFirstProvince, listDistricts } from "@/lib/api";

import { DistrictsPage } from "./DistrictsPage";

vi.mock("@/lib/api", () => ({
  getFirstProvince: vi.fn(),
  listDistricts: vi.fn(),
}));

describe("DistrictsPage", () => {
  it("renders a locale-prefixed district card link", async () => {
    vi.mocked(getFirstProvince).mockResolvedValue({
      id: 1,
      nameThai: "ยโสธร",
      nameEnglish: "Yasothon",
    });
    vi.mocked(listDistricts).mockResolvedValue([
      {
        id: 10,
        provinceId: 1,
        nameThai: "เมืองยโสธร",
        nameEnglish: "Mueang Yasothon",
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale="th">
          <MemoryRouter initialEntries={["/th/districts"]}>
            <Routes>
              <Route path="/:lang/districts" element={<DistrictsPage />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    const card = await screen.findByRole("link", { name: /เมืองยโสธร/ });
    expect(card).toHaveAttribute("href", "/th/districts/10");

    expect(getFirstProvince).toHaveBeenCalled();
    expect(listDistricts).toHaveBeenCalledWith(1);
  });
});
