import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { CaseForm } from "./CaseForm";

const remedyOptions = [
  { value: 5, label: "ยาต้ม · หมอสมชาย · เมือง · เชียงใหม่", healerId: 2 },
  { value: 6, label: "ยาพอก · หมอสมหญิง · แม่ริม · เชียงใหม่", healerId: 3 },
];

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CaseForm (create)", () => {
  it("defaults the remedy combobox to the first option", () => {
    renderWithClient(<CaseForm remedyOptions={remedyOptions} />);
    expect(screen.getByLabelText(/^remedy/i)).toHaveValue("ยาต้ม · หมอสมชาย · เมือง · เชียงใหม่");
  });

  it("requires patient sex and a date", async () => {
    renderWithClient(<CaseForm remedyOptions={remedyOptions} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/patient sex is required/i)).toBeInTheDocument();
  });

  it("posts a new case with the chosen remedy and its derived healer, then navigates back", async () => {
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string; body?: string }) => {
      void url;
      void opts;
      return { ok: true, status: 201, json: async () => ({ id: 9 }) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<CaseForm remedyOptions={remedyOptions} />);
    const remedyInput = screen.getByLabelText(/^remedy/i);
    await userEvent.click(remedyInput);
    await userEvent.clear(remedyInput);
    await userEvent.type(remedyInput, "ยาพอก");
    await userEvent.click(await screen.findByRole("option", { name: /ยาพอก/ }));
    await userEvent.type(screen.getByLabelText(/patient sex/i), "female");
    await userEvent.type(screen.getByLabelText(/age/i), "40");
    await userEvent.type(screen.getByLabelText(/date treated/i), "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/treatment-cases", expect.objectContaining({ method: "POST" })),
    );
    const call = fetchMock.mock.calls.find(([url]) => url === "/bff/treatment-cases")!;
    const body = JSON.parse(call[1]!.body as string);
    expect(body.remedyId).toBe(6);
    expect(body.healerId).toBe(3);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/cases"));
  });

  it("defaults the remedy combobox to defaultRemedyId when creating from a remedy's drill-in page", () => {
    renderWithClient(<CaseForm remedyOptions={remedyOptions} defaultRemedyId={6} />);
    expect(screen.getByLabelText(/^remedy/i)).toHaveValue("ยาพอก · หมอสมหญิง · แม่ริม · เชียงใหม่");
  });

  it("defaults the remedy combobox to the case's current remedy when editing", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch,
    );
    const treatmentCase = {
      id: 8,
      remedyId: 6,
      healerId: 3,
      patientAge: 40,
      patientSex: "female",
      symptoms: "",
      result: "",
      note: "",
      treatedOn: "2026-03-01",
      createdAt: "",
      updatedAt: "",
    };
    renderWithClient(<CaseForm treatmentCase={treatmentCase} remedyOptions={remedyOptions} />);
    expect(screen.getByLabelText(/^remedy/i)).toHaveValue("ยาพอก · หมอสมหญิง · แม่ริม · เชียงใหม่");
  });
});
