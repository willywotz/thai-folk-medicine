import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { listTreatmentCases } from "@/lib/api";

import { TreatmentCasesPage } from "./TreatmentCasesPage";

vi.mock("@/lib/api", () => ({ listTreatmentCases: vi.fn() }));

describe("TreatmentCasesPage", () => {
  it("renders case symptoms and a locale-prefixed view-remedy link", async () => {
    vi.mocked(listTreatmentCases).mockResolvedValue({
      items: [
        {
          id: 1,
          remedyId: 3,
          healerId: 2,
          patientAge: 40,
          patientSex: "male",
          symptoms: "ไอ",
          result: "ดีขึ้น",
          note: "",
          treatedOn: "2026-01-02",
          createdAt: "",
          updatedAt: "",
        },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      pageSize: 12,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale="th">
          <MemoryRouter initialEntries={["/th/treatment-cases"]}>
            <Routes>
              <Route path="/:lang/treatment-cases" element={<TreatmentCasesPage />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("ไอ")).toBeInTheDocument();

    const viewRemedy = screen.getByRole("link", { name: th.case.viewRemedy });
    expect(viewRemedy).toHaveAttribute("href", "/th/remedies/3");

    expect(listTreatmentCases).toHaveBeenCalledWith({ page: 1 });
  });
});
