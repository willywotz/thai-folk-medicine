import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HerbsPage } from "./HerbsPage";

vi.mock("@/lib/api", () => ({
  listHerbs: vi.fn(async () => ({
    items: [
      {
        id: 5,
        nameThai: "มะกรูด",
        nameEnglish: "Kaffir lime",
        scientificName: "",
        properties: "",
        description: "",
        createdAt: "",
        updatedAt: "",
      },
    ],
    page: 1,
    totalPages: 1,
    total: 1,
    pageSize: 12,
  })),
  firstPhotoUrl: vi.fn(async () => undefined),
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
            <Route path="/:lang/herbs" element={<HerbsPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HerbsPage", () => {
  it("renders the page title and a herb card linking to the locale-prefixed detail", async () => {
    renderAt("/th/herbs");
    const card = await screen.findByRole("link", { name: /มะกรูด/ });
    expect(card).toHaveAttribute("href", "/th/herbs/5");
    expect(screen.getByRole("heading", { name: th.herb.title, level: 1 })).toBeInTheDocument();
  });
});
