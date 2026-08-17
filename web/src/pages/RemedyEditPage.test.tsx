import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { RemedyEditPage } from "./RemedyEditPage";

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
  listHealers: vi.fn(async () => ({
    items: [
      { id: 1, districtId: 7, fullName: "หมอ A", subDistrict: "", specialty: "", biography: "", createdAt: "", updatedAt: "" },
    ],
    page: 1,
    pageSize: 48,
    total: 1,
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
            <Route path="/:lang/staff/remedies/:remedyId/edit" element={<RemedyEditPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RemedyEditPage", () => {
  it("loads remedy + healers and wires them into RemedyForm", async () => {
    renderAt("/th/staff/remedies/3/edit");
    expect(await screen.findByTestId("remedy-form")).toBeInTheDocument();
    expect(formMock).toHaveBeenCalledWith(
      expect.objectContaining({
        remedy: expect.objectContaining({ id: 3, name: "ยาแก้ไอ" }),
        healerOptions: expect.arrayContaining([
          expect.objectContaining({ value: 1, label: "หมอ A" }),
        ]),
      }),
    );
  });

  it("renders NotFound when the remedy does not exist", async () => {
    renderAt("/th/staff/remedies/99/edit");
    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(formMock).not.toHaveBeenCalled();
    expect(th.staff.headers.remedies).toBeTruthy();
  });
});
