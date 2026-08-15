import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { HealerForm } from "./HealerForm";

const districts = [
  { id: 3, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" },
  { id: 4, provinceId: 1, nameThai: "แม่ริม", nameEnglish: "Mae Rim" },
];

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HealerForm (create)", () => {
  it("validates the required name", async () => {
    renderWithClient(<HealerForm districts={districts} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
  });

  it("requires a district and defaults to the first option", () => {
    renderWithClient(<HealerForm districts={districts} />);
    const select = screen.getByLabelText(/^district/i);
    expect(select).toHaveAttribute("required");
    expect(select).toHaveValue("3");
  });

  it("posts a new healer with the selected district", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<HealerForm districts={districts} />);
    await userEvent.type(screen.getByLabelText(/full name/i), "หมอสมชาย");
    await userEvent.selectOptions(screen.getByLabelText(/^district/i), "4");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/bff/healers",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"districtId":4'),
        }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/healers"));
  });

  it("defaults the district select to the healer's current district when editing", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch,
    );
    const healer = {
      id: 1,
      districtId: 4,
      fullName: "หมอ ก",
      subDistrict: "",
      specialty: "",
      biography: "",
      createdAt: "",
      updatedAt: "",
    };
    renderWithClient(<HealerForm healer={healer} districts={districts} />);
    expect(screen.getByLabelText(/^district/i)).toHaveValue("4");
  });
});
