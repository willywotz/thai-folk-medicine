import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";

import { CaseEditPage } from "./CaseEditPage";

vi.mock("@/components/CaseForm", () => ({
  CaseForm: vi.fn(({ treatmentCase, remedyOptions }) => (
    <div data-testid="case-form">
      <span data-testid="treatment-case">{treatmentCase ? `tc:${treatmentCase.id}` : "no-tc"}</span>
      {remedyOptions.map((o: { value: number; label: string; healerId: number }) => (
        <span key={o.value}>
          |{o.value}:{o.label}:{o.healerId}
        </span>
      ))}
    </div>
  )),
}));

vi.mock("@/lib/api", () => ({
  getTreatmentCase: vi.fn(async (id: number) =>
    id === 99
      ? null
      : {
          id,
          remedyId: 3,
          healerId: 1,
          patientAge: 40,
          patientSex: "male",
          symptoms: "",
          result: "",
          note: "",
          treatedOn: "2024-01-01",
          createdAt: "",
          updatedAt: "",
        },
  ),
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
  listHealers: vi.fn(async () => ({
    items: [
      {
        id: 1,
        fullName: "หมอเอ",
        districtId: 2,
        subDistrict: "",
        specialty: "",
        biography: "",
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
            <Route path="/:lang/staff/cases/:treatmentCaseId/edit" element={<CaseEditPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("CaseEditPage", () => {
  it("passes treatmentCase and remedyOptions to CaseForm", async () => {
    renderAt("/th/staff/cases/1/edit");
    expect(await screen.findByTestId("case-form")).toBeInTheDocument();
    expect(screen.getByTestId("treatment-case")).toHaveTextContent("tc:1");
    expect(screen.getByText("|3:ยาแก้ไอ:1")).toBeInTheDocument();
  });

  it("renders NotFound when treatment case is missing", async () => {
    renderAt("/th/staff/cases/99/edit");
    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(screen.queryByTestId("case-form")).not.toBeInTheDocument();
  });
});
