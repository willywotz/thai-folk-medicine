import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";

import { HerbEditPage } from "./HerbEditPage";

vi.mock("@/components/HerbForm", () => ({
  HerbForm: vi.fn(({ herb }) => (
    <div data-testid="herb-form">{herb ? `herb:${herb.id}` : "no-herb"}</div>
  )),
}));

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
            <Route path="/:lang/staff/herbs/:herbId/edit" element={<HerbEditPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HerbEditPage", () => {
  it("passes the fetched herb to HerbForm", async () => {
    renderAt("/th/staff/herbs/1/edit");
    expect(await screen.findByTestId("herb-form")).toBeInTheDocument();
    expect(screen.getByText("herb:1")).toBeInTheDocument();
  });

  it("renders NotFound when the herb is missing", async () => {
    renderAt("/th/staff/herbs/99/edit");
    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(screen.queryByTestId("herb-form")).not.toBeInTheDocument();
  });
});
