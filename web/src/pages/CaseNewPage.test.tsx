import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";

import { CaseNewPage } from "./CaseNewPage";

vi.mock("@/components/CaseForm", () => ({
  CaseForm: vi.fn(({ remedyOptions, defaultRemedyId }) => (
    <div data-testid="case-form">
      <span data-testid="default-remedy">
        {defaultRemedyId === undefined ? "no-default" : `default:${defaultRemedyId}`}
      </span>
      {remedyOptions.map((o: { value: number; label: string; healerId: number }) => (
        <span key={o.value}>
          |{o.value}:{o.label}:{o.healerId}
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
            <Route path="/:lang/staff/cases/new" element={<CaseNewPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("CaseNewPage", () => {
  it("passes remedyOptions and parsed defaultRemedyId from ?remedyId=", async () => {
    renderAt("/th/staff/cases/new?remedyId=3");
    expect(await screen.findByTestId("case-form")).toBeInTheDocument();
    expect(screen.getByTestId("default-remedy")).toHaveTextContent("default:3");
    expect(screen.getByText("|3:ยาแก้ไอ:1")).toBeInTheDocument();
  });

  it("passes defaultRemedyId undefined when ?remedyId absent", async () => {
    renderAt("/th/staff/cases/new");
    expect(await screen.findByTestId("case-form")).toBeInTheDocument();
    expect(screen.getByTestId("default-remedy")).toHaveTextContent("no-default");
  });
});
