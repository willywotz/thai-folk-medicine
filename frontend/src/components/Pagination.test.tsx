import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { th } from "@/lib/i18n/dictionaries/th";

vi.mock("@/lib/i18n/getDictionary", () => ({
  getDictionary: async () => th,
}));

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("preserves other params and links to the next page", async () => {
    render(
      await Pagination({
        page: 2,
        totalPages: 5,
        basePath: "/remedies",
        searchParams: { herbId: "3", page: "2" },
      }),
    );
    const next = screen.getByRole("link", { name: th.common.next });
    expect(next.getAttribute("href")).toBe("/remedies?herbId=3&page=3");
  });

  it("renders nothing for a single page", async () => {
    const { container } = render(
      await Pagination({ page: 1, totalPages: 1, basePath: "/x", searchParams: {} }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no Prev link on page 1", async () => {
    render(await Pagination({ page: 1, totalPages: 3, basePath: "/x", searchParams: {} }));
    expect(screen.queryByRole("link", { name: th.common.previous })).toBeNull();
  });

  it("has no Next link on the last page", async () => {
    render(await Pagination({ page: 3, totalPages: 3, basePath: "/x", searchParams: {} }));
    expect(screen.queryByRole("link", { name: th.common.next })).toBeNull();
  });

  it("renders a link to the current page number", async () => {
    render(await Pagination({ page: 2, totalPages: 3, basePath: "/x", searchParams: {} }));
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", "/x?page=2");
  });
});
