import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { StaffRemediesPage } from "./StaffRemediesPage";

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

const listMock = vi.fn();
vi.mock("@/components/RemedyAdminList", () => ({
  RemedyAdminList: (props: unknown) => {
    listMock(props);
    return <div data-testid="remedy-admin-list" />;
  },
}));

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/staff/remedies" element={<StaffRemediesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("StaffRemediesPage", () => {
  it("fetches healers and wires them into RemedyAdminList with a locale-prefixed crumb", async () => {
    renderAt("/th/staff/remedies");
    expect(await screen.findByTestId("remedy-admin-list")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        healers: expect.arrayContaining([
          expect.objectContaining({ id: 1, fullName: "หมอ A" }),
          expect.objectContaining({ id: 2, fullName: "หมอ B" }),
        ]),
      }),
    );
    expect(screen.getByRole("link", { name: /พื้นที่เจ้าหน้าที่/ })).toHaveAttribute(
      "href",
      "/th/staff",
    );
  });
});
