import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, it } from "vitest";

import { LangLayout } from "./LangLayout";
import { useLocale, useT } from "./useT";

function Probe() {
  const t = useT();
  const locale = useLocale();
  return (
    <div>
      <span data-testid="home">{t.common.home}</span>
      <span data-testid="locale">{locale}</span>
    </div>
  );
}

function routerAt(path: string) {
  return createMemoryRouter(
    [{ path: "/:lang", element: <LangLayout />, children: [{ index: true, element: <Probe /> }] }],
    { initialEntries: [path] },
  );
}

it("selects the Thai dictionary and locale under /th", () => {
  render(<RouterProvider router={routerAt("/th")} />);
  expect(screen.getByTestId("home")).toHaveTextContent("หน้าแรก");
  expect(screen.getByTestId("locale")).toHaveTextContent("th");
});

it("selects the English dictionary and locale under /en", () => {
  render(<RouterProvider router={routerAt("/en")} />);
  expect(screen.getByTestId("home")).toHaveTextContent("Home");
  expect(screen.getByTestId("locale")).toHaveTextContent("en");
});
