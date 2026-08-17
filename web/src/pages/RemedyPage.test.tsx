import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { RemedyPage } from "./RemedyPage";

const remedy = {
  id: 1,
  name: "ตำรับขิง",
  symptoms: "ไอ",
  healerId: 1,
  herbs: [
    { herbId: 9, nameThai: "ขิง", nameEnglish: "Ginger", amount: "1 แก้ว" },
  ],
  preparationMethod: "",
  usage: "",
  note: "",
  createdAt: "",
  updatedAt: "",
};

const emptyPage = { items: [], page: 1, totalPages: 1, total: 0, pageSize: 12 };

vi.mock("@/lib/api", () => ({
  getRemedy: vi.fn(async (id: number) => (id === 1 ? remedy : null)),
  listCasesByRemedy: vi.fn(async () => emptyPage),
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
            <Route path="/:lang/remedies/:remedyId" element={<RemedyPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("RemedyPage", () => {
  it("renders the remedy title and a locale-prefixed ingredient link", async () => {
    renderAt("/th/remedies/1");
    expect(await screen.findByRole("heading", { name: "ตำรับขิง" })).toBeInTheDocument();
    const herbLink = screen.getByRole("link", { name: "ขิง" });
    expect(herbLink).toHaveAttribute("href", "/th/herbs/9");
  });

  it("renders NotFound when the remedy does not exist", async () => {
    renderAt("/th/remedies/404");
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});
