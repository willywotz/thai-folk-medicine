import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";

import { StaffPagination } from "./StaffPagination";

function renderStaffPagination(props: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  return render(
    <I18nProvider locale="th">
      <StaffPagination {...props} />
    </I18nProvider>,
  );
}

describe("StaffPagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = renderStaffPagination({ page: 1, totalPages: 1, onPage: vi.fn() });
    expect(container).toBeEmptyDOMElement();
  });

  it("disables Prev on page 1 and Next on the last page", () => {
    renderStaffPagination({ page: 1, totalPages: 3, onPage: vi.fn() });
    expect(screen.getByRole("button", { name: th.common.previous })).toBeDisabled();
    expect(screen.getByRole("button", { name: th.common.next })).not.toBeDisabled();
  });

  it("shows the page indicator and reports the next page", async () => {
    const onPage = vi.fn();
    renderStaffPagination({ page: 2, totalPages: 5, onPage });
    expect(screen.getByText(th.common.pageXofY(2, 5))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: th.common.next }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("reports the previous page", async () => {
    const onPage = vi.fn();
    renderStaffPagination({ page: 2, totalPages: 5, onPage });
    await userEvent.click(screen.getByRole("button", { name: th.common.previous }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});
