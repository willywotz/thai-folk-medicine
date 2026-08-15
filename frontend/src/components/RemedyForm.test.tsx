import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { RemedyForm } from "./RemedyForm";

const healerOptions = [
  { value: 2, label: "หมอสมชาย · เมือง · เชียงใหม่" },
  { value: 3, label: "หมอสมหญิง · แม่ริม · เชียงใหม่" },
];

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

// stubFetch serves the HerbPicker's own herb list, PhotoManager's empty photo
// list (edit mode only), and a generic save response.
function stubFetch() {
  return vi.fn(async (url: string, opts?: { method?: string; body?: string }) => {
    void opts;
    if (typeof url === "string" && url.startsWith("/api/v1/herbs")) {
      return {
        ok: true,
        json: async () => ({
          items: [{ id: 7, nameThai: "ขิง" }],
          page: 1,
          pageSize: 48,
          total: 1,
          totalPages: 1,
        }),
      };
    }
    if (typeof url === "string" && url.startsWith("/api/v1/photos")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, status: 201, json: async () => ({ id: 9 }) };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RemedyForm (create)", () => {
  it("validates the required name", async () => {
    vi.stubGlobal("fetch", stubFetch() as unknown as typeof fetch);
    renderWithClient(<RemedyForm healerOptions={healerOptions} />);
    await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("defaults the healer combobox to the first option", () => {
    vi.stubGlobal("fetch", stubFetch() as unknown as typeof fetch);
    renderWithClient(<RemedyForm healerOptions={healerOptions} />);
    expect(screen.getByLabelText(/healer/i)).toHaveValue("หมอสมชาย · เมือง · เชียงใหม่");
  });

  it("adds a herb via the picker and posts a new remedy with the selected healer", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<RemedyForm healerOptions={healerOptions} />);
    await userEvent.type(screen.getByLabelText("ชื่อตำรับยา"), "ยาต้ม");
    const healerInput = screen.getByLabelText(/healer/i);
    await userEvent.click(healerInput);
    await userEvent.clear(healerInput);
    await userEvent.type(healerInput, "หมอสมหญิง");
    await userEvent.click(await screen.findByRole("option", { name: /หมอสมหญิง/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /add herb/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: /add herb/i }));
    await screen.findByRole("combobox", { name: /herb/i });
    await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/bff/remedies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"healerId":3'),
        }),
      ),
    );
    const call = fetchMock.mock.calls.find(([url]) => url === "/bff/remedies")!;
    const body = JSON.parse(call[1]!.body as string);
    expect(body.herbs).toEqual([{ herbId: 7, amount: "" }]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/remedies"));
  });

  it("defaults the healer combobox to defaultHealerId when creating from a healer's drill-in page", () => {
    vi.stubGlobal("fetch", stubFetch() as unknown as typeof fetch);
    renderWithClient(<RemedyForm healerOptions={healerOptions} defaultHealerId={3} />);
    expect(screen.getByLabelText(/healer/i)).toHaveValue("หมอสมหญิง · แม่ริม · เชียงใหม่");
  });

  it("defaults the healer combobox to the remedy's current healer when editing", () => {
    vi.stubGlobal("fetch", stubFetch() as unknown as typeof fetch);
    const remedy = {
      id: 5,
      healerId: 3,
      name: "ยาต้ม",
      symptoms: "",
      herbs: [],
      preparationMethod: "",
      usage: "",
      note: "",
      createdAt: "",
      updatedAt: "",
    };
    renderWithClient(<RemedyForm remedy={remedy} healerOptions={healerOptions} />);
    expect(screen.getByLabelText(/healer/i)).toHaveValue("หมอสมหญิง · แม่ริม · เชียงใหม่");
  });
});
