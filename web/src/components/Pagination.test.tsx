import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { th } from "@/lib/i18n/dictionaries/th";
import { I18nProvider } from "@/components/I18nProvider";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders a page link with the right `to` attribute", () => {
    render(
      <BrowserRouter>
        <I18nProvider locale="th">
          <Pagination
            page={2}
            totalPages={5}
            basePath="/remedies"
            searchParams={{ herbId: "3", page: "2" }}
          />
        </I18nProvider>
      </BrowserRouter>,
    );
    const nextLink = screen.getByRole("link", { name: th.common.next });
    expect(nextLink).toHaveAttribute("href", "/remedies?herbId=3&page=3");
  });
});
