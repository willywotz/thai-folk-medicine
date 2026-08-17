import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { LangLayout } from "./provider";
import { useT } from "./useT";

function Probe() {
  const { lang, t } = useT();
  return <div>{lang}:{Object.keys(t).length > 0 ? "HAS_DICT" : "EMPTY"}</div>;
}

function routerAt(path: string) {
  return createMemoryRouter(
    [{ path: "/:lang", element: <LangLayout />, children: [{ index: true, element: <Probe /> }] }],
    { initialEntries: [path] },
  );
}

it("selects the Thai dictionary under /th", () => {
  render(<RouterProvider router={routerAt("/th")} />);
  expect(screen.getByText("th:HAS_DICT")).toBeInTheDocument();
});

it("selects the English dictionary under /en", () => {
  render(<RouterProvider router={routerAt("/en")} />);
  expect(screen.getByText("en:HAS_DICT")).toBeInTheDocument();
});
