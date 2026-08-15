import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StaffPagination } from "./StaffPagination";

describe("StaffPagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<StaffPagination page={1} totalPages={1} onPage={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables Prev on page 1 and Next on the last page", () => {
    render(<StaffPagination page={1} totalPages={3} onPage={vi.fn()} />);
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });

  it("shows the page indicator and reports the next page", async () => {
    const onPage = vi.fn();
    render(<StaffPagination page={2} totalPages={5} onPage={onPage} />);
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("reports the previous page", async () => {
    const onPage = vi.fn();
    render(<StaffPagination page={2} totalPages={5} onPage={onPage} />);
    await userEvent.click(screen.getByRole("button", { name: /prev/i }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});
