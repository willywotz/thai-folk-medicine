import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { useT } from "./useT";

function Probe() {
  const t = useT();
  return (
    <>
      <span>{t.common.home}</span>
      <span>{t.home.treatedWithRemedy(5)}</span>
    </>
  );
}

describe("useT", () => {
  it("selects the dict by locale, including functions", () => {
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });
});
