import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { firstPhotoUrl, listHerbs, listProvinces, listRemedies, listTreatmentCases } from "@/lib/api";

import { HomePage } from "./HomePage";

vi.mock("@/lib/api", () => ({
  listHerbs: vi.fn(),
  listRemedies: vi.fn(),
  listTreatmentCases: vi.fn(),
  listProvinces: vi.fn(),
  firstPhotoUrl: vi.fn(),
}));

describe("HomePage", () => {
  it("renders the hero title and a locale-prefixed herb card link", async () => {
    vi.mocked(listHerbs).mockResolvedValue({
      items: [{ id: 7, nameThai: "ขิง", nameEnglish: "Ginger", scientificName: "", properties: "", description: "", createdAt: "", updatedAt: "" }],
      page: 1,
      totalPages: 1,
      total: 1,
      pageSize: 4,
    });
    vi.mocked(listRemedies).mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0, pageSize: 6 });
    vi.mocked(listTreatmentCases).mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0, pageSize: 6 });
    vi.mocked(listProvinces).mockResolvedValue([{ id: 1, nameThai: "ยโสธร", nameEnglish: "Yasothon" }]);
    vi.mocked(firstPhotoUrl).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale="th">
          <MemoryRouter initialEntries={["/th"]}>
            <Routes>
              <Route path="/:lang" element={<HomePage />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("ขิง")).toBeInTheDocument();

    expect(screen.getByText(th.home.heroTitle)).toBeInTheDocument();

    const herbLink = screen.getByRole("link", { name: /ขิง/ });
    expect(herbLink).toHaveAttribute("href", "/th/herbs/7");
  });
});
