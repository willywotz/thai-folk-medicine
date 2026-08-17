import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";

import { CasesPage } from "./CasesPage";

vi.mock("@/components/CaseAdminList", () => ({
  CaseAdminList: vi.fn(({ remedies }) => (
    <div data-testid="case-admin-list">
      {remedies.map((r: { id: number; name: string; healerId: number }) => (
        <span key={r.id}>
          {r.id}:{r.name}:{r.healerId}
        </span>
      ))}
    </div>
  )),
}));

vi.mock("@/lib/api", () => ({
  listRemedies: vi.fn(async () => ({
    items: [
      {
        id: 3,
        name: "ยาแก้ไอ",
        healerId: 1,
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
    totalPages: 1,
    total: 1,
    pageSize: 48,
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
            <Route path="/:lang/staff/cases" element={<CasesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("CasesPage", () => {
  it("fetches remedies and passes them to CaseAdminList", async () => {
    renderAt("/th/staff/cases");
    expect(await screen.findByText("3:ยาแก้ไอ:1")).toBeInTheDocument();
    expect(screen.getByTestId("case-admin-list")).toBeInTheDocument();
  });
});
