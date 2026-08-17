import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { StaffHerbsPage } from "./StaffHerbsPage";

vi.mock("@/components/HerbAdminList", () => ({
  HerbAdminList: () => <div data-testid="herb-admin-list" />,
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
            <Route path="/:lang/staff/herbs" element={<StaffHerbsPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("StaffHerbsPage", () => {
  it("renders the staff header and the HerbAdminList", () => {
    renderAt("/th/staff/herbs");
    expect(
      screen.getByRole("heading", { name: th.staff.headers.herbLibrary, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("herb-admin-list")).toBeInTheDocument();
  });
});
