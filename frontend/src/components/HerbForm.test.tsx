import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { HerbForm } from "./HerbForm";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HerbForm (create)", () => {
  it("requires the Thai name", async () => {
    renderWithClient(<HerbForm />);
    await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(await screen.findByText(/thai name is required/i)).toBeInTheDocument();
  });

  it("shows the pending-photo picker (no PhotoManager, no id yet)", () => {
    renderWithClient(<HerbForm />);
    expect(screen.getByText("ยังไม่ได้เพิ่มรูปภาพ")).toBeInTheDocument();
  });

  it("posts a new herb and navigates back", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<HerbForm />);
    await userEvent.type(screen.getByLabelText("ชื่อไทย"), "ขิง");
    await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/herbs", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/herbs"));
  });

  it("shows PhotoManager (not the pending-photo picker) when editing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch);
    const herb = {
      id: 1,
      nameThai: "ขิง",
      nameEnglish: "",
      scientificName: "",
      properties: "",
      description: "",
      createdAt: "",
      updatedAt: "",
    };
    renderWithClient(<HerbForm herb={herb} />);
    expect(await screen.findByText("ยังไม่มีรูปภาพ")).toBeInTheDocument();
    expect(screen.queryByText("ยังไม่ได้เพิ่มรูปภาพ")).toBeNull();
  });
});
