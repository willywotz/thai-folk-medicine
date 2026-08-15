import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { ProvinceAdminList } from "./ProvinceAdminList";

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

describe("ProvinceAdminList", () => {
  it("lists provinces with a link to the detail page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: 1, nameThai: "เชียงใหม่", nameEnglish: "Chiang Mai" }],
      })) as unknown as typeof fetch,
    );
    renderWithClient(<ProvinceAdminList />);
    expect(await screen.findByText("เชียงใหม่")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เชียงใหม่ Chiang Mai" })).toHaveAttribute(
      "href",
      "/staff/provinces/1",
    );
    expect(screen.getByRole("link", { name: "แก้ไข เชียงใหม่" })).toHaveAttribute("href", "/staff/provinces/1/edit");
    expect(screen.getByRole("button", { name: "ลบ เชียงใหม่" })).toBeInTheDocument();
  });

  it("shows a specific message when delete fails because it still has districts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return { ok: true, json: async () => [{ id: 1, nameThai: "เชียงใหม่", nameEnglish: "Chiang Mai" }] };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<ProvinceAdminList />);
    await screen.findByText("เชียงใหม่");
    await userEvent.click(screen.getByRole("button", { name: "ลบ เชียงใหม่" }));
    expect(
      await screen.findByText("จังหวัดนี้ยังมีอำเภออยู่ กรุณาลบอำเภอก่อน"),
    ).toBeInTheDocument();
    expect(screen.getByText("เชียงใหม่")).toBeInTheDocument();
  });
});
