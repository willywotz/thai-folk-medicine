import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { I18nProvider } from "@/components/I18nProvider";

import { HerbAdminList } from "./HerbAdminList";

vi.mock("@/lib/staff-queries", () => ({
  herbListKey: (...args: unknown[]) => ["herbs", ...args],
  fetchHerbs: async () => ({
    items: [
      {
        id: 5,
        nameThai: "ขิง",
        nameEnglish: "Ginger",
        scientificName: "",
        properties: "",
        description: "",
        createdAt: "",
        updatedAt: "",
      },
    ],
    page: 1,
    totalPages: 1,
    total: 1,
    pageSize: 20,
  }),
  deleteHerb: async () => undefined,
  fetchPhotos: async () => [],
  photoListKey: (ownerType: string, ownerId: number) => ["photos", ownerType, ownerId],
}));

vi.mock("@/lib/api", () => ({
  photoUrl: () => undefined,
  firstPhotoUrl: () => undefined,
}));

describe("AdminList locale links", () => {
  it("prefixes HerbAdminList links with the locale segment", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(
      [
        {
          path: "/:lang/staff/herbs",
          element: (
            <QueryClientProvider client={queryClient}>
              <I18nProvider locale="th">
                <HerbAdminList />
              </I18nProvider>
            </QueryClientProvider>
          ),
        },
      ],
      { initialEntries: ["/th/staff/herbs"] },
    );

    render(<RouterProvider router={router} />);

    // "+New" link (the + is aria-hidden; accessible name is the crumb text).
    const newLink = await screen.findByRole("link", { name: "สมุนไพรใหม่" });
    expect(newLink).toHaveAttribute("href", "/th/staff/herbs/new");

    // The edit link's aria-label is t.staff.editName("ขิง") = "แก้ไข ขิง".
    const editLink = await screen.findByLabelText("แก้ไข ขิง");
    expect(editLink).toHaveAttribute("href", "/th/staff/herbs/5/edit");
  });
});
