import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";

import { HerbUsagePage } from "./HerbUsagePage";

vi.mock("@/lib/api", () => ({
  getHerb: vi.fn(async (id: number) =>
    id === 99
      ? null
      : {
          id,
          nameThai: "ขิง",
          nameEnglish: "Ginger",
          scientificName: "",
          properties: "",
          description: "",
          createdAt: "",
          updatedAt: "",
        },
  ),
  listRemediesByHerb: vi.fn(async () => ({
    items: [
      {
        id: 7,
        healerId: 1,
        name: "ยาแก้ไอ",
        symptoms: "",
        herbs: [],
        preparationMethod: "",
        usage: "",
        note: "",
        createdAt: "",
        updatedAt: "",
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })),
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
            <Route path="/:lang/staff/herbs/:herbId" element={<HerbUsagePage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HerbUsagePage", () => {
  it("renders the remedy using this herb with a link to its staff edit page", async () => {
    renderAt("/th/staff/herbs/1");
    expect(await screen.findByText("ยาแก้ไอ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/th/staff/remedies/7/edit",
    );
  });

  it("renders NotFound when the herb is missing", async () => {
    renderAt("/th/staff/herbs/99");
    expect(await screen.findByText("404")).toBeInTheDocument();
  });
});
