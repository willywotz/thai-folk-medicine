import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HerbPage } from "./HerbPage";

const herb = {
  id: 1,
  nameThai: "ขิง",
  nameEnglish: "Ginger",
  scientificName: "Zingiber",
  properties: "สรรพคุณ",
  description: "desc",
  createdAt: "",
  updatedAt: "",
};

const emptyPage = { items: [], page: 1, totalPages: 1, total: 0, pageSize: 12 };

vi.mock("@/lib/api", () => ({
  getHerb: vi.fn(async (id: number) => (id === 1 ? herb : null)),
  listRemediesByHerb: vi.fn(async () => emptyPage),
  listPhotosByOwner: vi.fn(async () => []),
  firstPhotoUrl: vi.fn(async () => undefined),
  photoUrl: vi.fn((id: number) => `/api/v1/photos/${id}`),
}));

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/herbs/:herbId" element={<HerbPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HerbPage", () => {
  it("renders the herb title in the detail header", async () => {
    renderAt("/th/herbs/1");
    expect(await screen.findByRole("heading", { name: "ขิง", level: 1 })).toBeInTheDocument();
  });

  it("renders NotFound when the herb does not exist", async () => {
    renderAt("/th/herbs/99");
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});
