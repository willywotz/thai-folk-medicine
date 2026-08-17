import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { ApiError, search } from "@/lib/api";

import { SearchPage } from "./SearchPage";

vi.mock("@/lib/api", () => ({
  search: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

function renderSearch(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/:lang/search" element={<SearchPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(search).mockReset();
  });

  it("renders a locale-prefixed LinkRow for a hit when term length >= 2", async () => {
    vi.mocked(search).mockResolvedValue({
      items: [
        { type: "herb", id: 9, title: "ขิง", subtitle: "Ginger", score: 1 },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      pageSize: 20,
    });
    renderSearch("/th/search?searchTerm=ขิง");

    const link = await screen.findByRole("link", { name: /ขิง/ });
    expect(link).toHaveAttribute("href", "/th/herbs/9");
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain(th.search.resultsFor);
  });

  it("shows minChars and does not fetch when term length is 1", () => {
    renderSearch("/th/search?searchTerm=ก");

    expect(screen.getByText(th.search.minChars)).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it("shows minChars when the search call rejects with ApiError 400", async () => {
    vi.mocked(search).mockRejectedValue(new ApiError("bad", 400));
    renderSearch("/th/search?searchTerm=ขิง");

    expect(await screen.findByText(th.search.minChars)).toBeInTheDocument();
  });
});
