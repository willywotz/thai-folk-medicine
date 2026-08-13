import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { CaseForm } from "./CaseForm";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CaseForm (create)", () => {
  it("requires patient sex and a date", async () => {
    renderWithClient(<CaseForm remedyId={5} healerId={2} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/patient sex is required/i)).toBeInTheDocument();
  });

  it("posts a new case and navigates back", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<CaseForm remedyId={5} healerId={2} />);
    await userEvent.type(screen.getByLabelText(/patient sex/i), "female");
    await userEvent.type(screen.getByLabelText(/age/i), "40");
    await userEvent.type(screen.getByLabelText(/date treated/i), "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/treatment-cases", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/remedies/5/treatment-cases"));
  });
});
