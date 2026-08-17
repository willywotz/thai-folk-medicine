import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { HealerPage } from "./HealerPage";

vi.mock("@/lib/api", () => ({
  getHealer: vi.fn(),
  listRemediesByHealer: vi.fn(),
  firstPhotoUrl: vi.fn(),
}));

const { getHealer, listRemediesByHealer, firstPhotoUrl } = await import("@/lib/api");

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/:lang/healers/:healerId" element={<HealerPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("HealerPage", () => {
  it("renders the healer name and a locale-prefixed remedy link", async () => {
    vi.mocked(getHealer).mockResolvedValue({
      id: 2,
      districtId: 10,
      fullName: "หมอทดสอบ",
      subDistrict: "บ้าน",
      specialty: "ไล่ผี",
      biography: "ประวัติ",
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(listRemediesByHealer).mockResolvedValue({
      items: [
        {
          id: 3,
          name: "ยาแก้ไอ",
          symptoms: "ไอ",
          healerId: 2,
          herbs: [],
          preparationMethod: "",
          usage: "",
          note: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      pageSize: 12,
    });
    vi.mocked(firstPhotoUrl).mockResolvedValue(undefined);

    renderAt("/th/healers/2");

    expect(await screen.findByRole("heading", { level: 1, name: "หมอทดสอบ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ยาแก้ไอ/ })).toHaveAttribute(
      "href",
      "/th/remedies/3",
    );
  });

  it("renders NotFound when the healer does not exist", async () => {
    vi.mocked(getHealer).mockResolvedValue(null);

    renderAt("/th/healers/999");

    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});
