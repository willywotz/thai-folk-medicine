import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HerbNewPage } from "./HerbNewPage";

vi.mock("@/components/HerbForm", () => ({
  HerbForm: () => <div data-testid="herb-form" />,
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
            <Route path="/:lang/staff/herbs/new" element={<HerbNewPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HerbNewPage", () => {
  it("renders the staff header and the HerbForm", () => {
    renderAt("/th/staff/herbs/new");
    expect(
      screen.getByRole("heading", { name: th.staff.addHerbTitle, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("herb-form")).toBeInTheDocument();
  });
});
