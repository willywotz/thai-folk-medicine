import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { LangLayout } from "./provider";
import { useT } from "./useT";

function Probe() {
  const { t } = useT();
  return <div>{t.common.home}</div>;
}

function routerAt(path: string) {
  return createMemoryRouter(
    [{ path: "/:lang", element: <LangLayout />, children: [{ index: true, element: <Probe /> }] }],
    { initialEntries: [path] },
  );
}

it("selects the Thai dictionary under /th", () => {
  render(<RouterProvider router={routerAt("/th")} />);
  expect(screen.getByText("หน้าแรก")).toBeInTheDocument();
});

it("selects the English dictionary under /en", () => {
  render(<RouterProvider router={routerAt("/en")} />);
  expect(screen.getByText("Home")).toBeInTheDocument();
});
