import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { DistrictForm } from "./DistrictForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

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

describe("DistrictForm (create)", () => {
  it("requires the Thai name", async () => {
    renderWithClient(<DistrictForm provinceId={1} />);
    await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(await screen.findByText(/thai name is required/i)).toBeInTheDocument();
  });

  it("posts a new district and navigates back to the province", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<DistrictForm provinceId={1} />);
    await userEvent.type(screen.getByLabelText("ชื่อไทย"), "อำเภอเมือง");
    await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/districts", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/provinces/1"));
  });

  it("cancel returns to the province page", async () => {
    renderWithClient(<DistrictForm provinceId={1} />);
    await userEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(push).toHaveBeenCalledWith("/staff/provinces/1");
  });
});
