import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchBox } from "./SearchBox";

vi.mock("@/lib/i18n/getDictionary", () => ({
  getDictionary: async () => (await import("@/lib/i18n/dictionaries/th")).th,
}));

describe("SearchBox", () => {
  it("submits the term to /search via GET", async () => {
    render(await SearchBox({}));
    const input = screen.getByRole("searchbox");
    const form = input.closest("form");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(input).toHaveAttribute("name", "searchTerm");
  });

  it("shows the current term as the default value", async () => {
    render(await SearchBox({ defaultValue: "ไข้" }));
    expect(screen.getByRole("searchbox")).toHaveValue("ไข้");
  });

  it("keeps the input and button", async () => {
    render(await SearchBox({ size: "sm" }));
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ค้นหา" })).toBeInTheDocument();
  });
});
