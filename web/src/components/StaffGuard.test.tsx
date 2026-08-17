import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffGuard from "./StaffGuard";

afterEach(() => vi.restoreAllMocks());

function renderGuard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "/:lang",
        children: [
          { element: <StaffGuard />, children: [{ path: "staff", element: <div>SECRET</div> }] },
          { path: "login", element: <div>LOGIN PAGE</div> },
        ],
      },
    ],
    { initialEntries: ["/th/staff"] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

it("renders the guarded content when the session probe returns 200", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  renderGuard();
  await waitFor(() => expect(screen.getByText("SECRET")).toBeInTheDocument());
});

it("redirects to login when the session probe returns 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
  renderGuard();
  await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
});
