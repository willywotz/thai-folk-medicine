import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { RemedyNewPage } from "./RemedyNewPage";

vi.mock("@/lib/api", () => ({
  listHealers: vi.fn(async () => ({
    items: [
      { id: 1, districtId: 7, fullName: "หมอ A", subDistrict: "", specialty: "", biography: "", createdAt: "", updatedAt: "" },
      { id: 2, districtId: 7, fullName: "หมอ B", subDistrict: "", specialty: "", biography: "", createdAt: "", updatedAt: "" },
    ],
    page: 1,
    pageSize: 48,
    total: 2,
    totalPages: 1,
  })),
}));

const formMock = vi.fn();
vi.mock("@/components/RemedyForm", () => ({
  RemedyForm: (props: unknown) => {
    formMock(props);
    return <div data-testid="remedy-form" />;
  },
}));

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/staff/remedies/new" element={<RemedyNewPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("RemedyNewPage", () => {
  it("passes healerOptions and parsed defaultHealerId from ?healerId=", async () => {
    renderAt("/th/staff/remedies/new?healerId=2");
    expect(await screen.findByTestId("remedy-form")).toBeInTheDocument();
    expect(formMock).toHaveBeenCalledWith(
      expect.objectContaining({
        healerOptions: expect.arrayContaining([
          expect.objectContaining({ value: 1, label: "หมอ A" }),
          expect.objectContaining({ value: 2, label: "หมอ B" }),
        ]),
        defaultHealerId: 2,
      }),
    );
  });

  it("passes defaultHealerId undefined when ?healerId is absent", async () => {
    renderAt("/th/staff/remedies/new");
    expect(await screen.findByTestId("remedy-form")).toBeInTheDocument();
    expect(formMock).toHaveBeenCalledWith(
      expect.objectContaining({ defaultHealerId: undefined }),
    );
  });
});
