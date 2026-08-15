import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("preserves other params and links to the next page", () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        basePath="/remedies"
        searchParams={{ herbId: "3", page: "2" }}
      />,
    );
    const next = screen.getByRole("link", { name: /next/i });
    expect(next.getAttribute("href")).toBe("/remedies?herbId=3&page=3");
  });

  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} basePath="/x" searchParams={{}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no Prev link on page 1", () => {
    render(<Pagination page={1} totalPages={3} basePath="/x" searchParams={{}} />);
    expect(screen.queryByRole("link", { name: /prev/i })).toBeNull();
  });

  it("has no Next link on the last page", () => {
    render(<Pagination page={3} totalPages={3} basePath="/x" searchParams={{}} />);
    expect(screen.queryByRole("link", { name: /next/i })).toBeNull();
  });

  it("renders a link to the current page number", () => {
    render(<Pagination page={2} totalPages={3} basePath="/x" searchParams={{}} />);
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", "/x?page=2");
  });
});
