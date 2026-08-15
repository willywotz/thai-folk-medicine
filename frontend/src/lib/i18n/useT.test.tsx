import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { en } from "./dictionaries/en";
import { useT } from "./useT";

function Probe() {
  const t = useT();
  return <span>{t.common.home}</span>;
}

describe("useT", () => {
  it("reads the dict from the provider", () => {
    render(
      <I18nProvider locale="en" dict={en}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});
