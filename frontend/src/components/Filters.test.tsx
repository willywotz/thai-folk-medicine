import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Filters, type FilterField } from "./Filters";

const fields: FilterField[] = [
  {
    kind: "select",
    name: "herbId",
    label: "Herb",
    options: [
      { value: "1", label: "Ginger" },
      { value: "2", label: "Turmeric" },
    ],
  },
  {
    kind: "text",
    name: "searchTerm",
    label: "Search",
    placeholder: "Type here",
  },
];

describe("Filters", () => {
  it("renders a native GET form with the given action", () => {
    render(<Filters action="/remedies" fields={fields} values={{}} />);
    const form = screen.getByRole("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/remedies");
  });

  it("marks the select option from values as selected", () => {
    render(
      <Filters action="/remedies" fields={fields} values={{ herbId: "2" }} />,
    );
    const select = screen.getByLabelText("Herb") as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect(screen.getByRole("option", { name: "Ginger" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Turmeric" })).toBeInTheDocument();
  });

  it("pre-fills the text input from values", () => {
    render(
      <Filters
        action="/remedies"
        fields={fields}
        values={{ searchTerm: "ขิง" }}
      />,
    );
    const input = screen.getByLabelText("Search") as HTMLInputElement;
    expect(input.value).toBe("ขิง");
    expect(input).toHaveAttribute("placeholder", "Type here");
  });

  it("renders a clear link pointing at the bare action path", () => {
    render(
      <Filters
        action="/remedies"
        fields={fields}
        values={{ herbId: "2", searchTerm: "ขิง" }}
      />,
    );
    expect(screen.getByRole("link", { name: /clear|ล้าง/i })).toHaveAttribute(
      "href",
      "/remedies",
    );
  });
});
