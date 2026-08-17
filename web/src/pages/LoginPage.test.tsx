import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { LoginPage } from "./LoginPage";

vi.mock("@/components/LoginForm", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiGet }));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/login" element={<LoginPage />} />
            <Route path="/:lang/staff" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  it("renders the title and form when there is no session", async () => {
    apiGet.mockRejectedValue(new Error("401"));
    renderAt("/th/login");
    expect(await screen.findByRole("heading", { name: th.login.title })).toBeInTheDocument();
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("redirects to the locale-prefixed staff page when a session exists", async () => {
    apiGet.mockResolvedValue({ username: "admin" });
    renderAt("/th/login");
    expect(await screen.findByTestId("location")).toHaveTextContent("/th/staff");
  });
});
