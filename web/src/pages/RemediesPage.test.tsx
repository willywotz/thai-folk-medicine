import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";

import { RemediesPage } from "./RemediesPage";

vi.mock("@/lib/api", () => ({
  listRemedies: vi.fn(async () => ({
    items: [
      {
        id: 3,
        name: "ยาแก้ไอ",
        symptoms: "ไอ",
        healerId: 1,
        herbs: [],
        preparationMethod: "",
        usage: "",
        note: "",
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
            <Route path="/:lang/remedies" element={<RemediesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("RemediesPage", () => {
  it("renders a remedy card linking to the locale-prefixed detail", async () => {
    renderAt("/th/remedies");
    const card = await screen.findByRole("link", { name: /ยาแก้ไอ/ });
    expect(card).toHaveAttribute("href", "/th/remedies/3");
  });
});
