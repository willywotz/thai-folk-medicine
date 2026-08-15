import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { DistrictAdminList } from "./DistrictAdminList";

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

describe("DistrictAdminList", () => {
  it("lists districts with edit and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: 1, provinceId: 3, nameThai: "อำเภอเมือง", nameEnglish: "Mueang" }],
      })) as unknown as typeof fetch,
    );
    renderWithClient(<DistrictAdminList provinceId={3} />);
    expect(await screen.findByText("อำเภอเมือง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แก้ไข อำเภอเมือง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลบ อำเภอเมือง" })).toBeInTheDocument();
  });

  it("shows a specific message when delete fails because it still has healers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return {
          ok: true,
          json: async () => [{ id: 1, provinceId: 3, nameThai: "อำเภอเมือง", nameEnglish: "Mueang" }],
        };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<DistrictAdminList provinceId={3} />);
    await screen.findByText("อำเภอเมือง");
    await userEvent.click(screen.getByRole("button", { name: "ลบ อำเภอเมือง" }));
    expect(
      await screen.findByText("อำเภอนี้ยังมีหมอพื้นบ้านอยู่ กรุณาลบหมอพื้นบ้านก่อน"),
    ).toBeInTheDocument();
    expect(screen.getByText("อำเภอเมือง")).toBeInTheDocument();
  });
});
