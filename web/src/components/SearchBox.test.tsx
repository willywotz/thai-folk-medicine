import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { SearchBox } from "./SearchBox";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

describe("SearchBox", () => {
  it("navigates to the locale-prefixed /search with the term", async () => {
    render(
      <MemoryRouter initialEntries={["/th"]}>
        <I18nProvider locale="th">
          <Routes>
            <Route path="/:lang" element={<><SearchBox /><LocationProbe /></>} />
            <Route path="/:lang/search" element={<LocationProbe />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(th.search.boxPlaceholder), "ขิง");
    await userEvent.click(screen.getByRole("button", { name: th.common.search }));
    const loc = screen.getByTestId("loc").textContent ?? "";
    expect(loc).toContain("/th/search");
    expect(loc).toContain("searchTerm=");
    // the term must round-trip (encoded or decoded depending on RRR version):
    expect(decodeURIComponent(loc)).toContain("ขิง");
  });
});
