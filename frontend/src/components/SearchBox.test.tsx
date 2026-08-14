import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("submits the term to /search via GET", () => {
    render(<SearchBox />);
    const input = screen.getByRole("searchbox");
    const form = input.closest("form");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(input).toHaveAttribute("name", "searchTerm");
  });

  it("shows the current term as the default value", () => {
    render(<SearchBox defaultValue="ไข้" />);
    expect(screen.getByRole("searchbox")).toHaveValue("ไข้");
  });
});
