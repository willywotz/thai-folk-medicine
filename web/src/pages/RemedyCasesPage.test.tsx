import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { RemedyCasesPage } from "./RemedyCasesPage";

const remedyFixture = {
  id: 3,
  healerId: 1,
  name: "ยาแก้ไอ",
  symptoms: "ไอ",
  herbs: [],
  preparationMethod: "",
  usage: "",
  note: "",
  createdAt: "",
  updatedAt: "",
};

vi.mock("@/lib/api", () => ({
  getRemedy: vi.fn(async (id: number) => (id === 3 ? remedyFixture : null)),
  listRemedies: vi.fn(async () => ({
    items: [
      { id: 3, healerId: 1, name: "ยาแก้ไอ", symptoms: "", herbs: [], preparationMethod: "", usage: "", note: "", createdAt: "", updatedAt: "" },
      { id: 5, healerId: 2, name: "ยาหอม", symptoms: "", herbs: [], preparationMethod: "", usage: "", note: "", createdAt: "", updatedAt: "" },
    ],
    page: 1,
    pageSize: 48,
    total: 2,
    totalPages: 1,
  })),
}));

const listMock = vi.fn();
vi.mock("@/components/CaseAdminList", () => ({
  CaseAdminList: (props: unknown) => {
    listMock(props);
    return <div data-testid="case-admin-list" />;
  },
}));

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/staff/remedies/:remedyId/treatment-cases" element={<RemedyCasesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RemedyCasesPage", () => {
  it("loads remedy + remedies and wires them into CaseAdminList with remedyId", async () => {
    renderAt("/th/staff/remedies/3/treatment-cases");
    expect(await screen.findByTestId("case-admin-list")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        remedies: expect.arrayContaining([
          expect.objectContaining({ id: 3, name: "ยาแก้ไอ", healerId: 1 }),
          expect.objectContaining({ id: 5, name: "ยาหอม", healerId: 2 }),
        ]),
        remedyId: 3,
      }),
    );
  });

  it("renders NotFound when the remedy does not exist", async () => {
    renderAt("/th/staff/remedies/99/treatment-cases");
    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });
});
