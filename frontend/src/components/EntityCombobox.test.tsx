import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { EntityCombobox } from "./EntityCombobox";

const options = [
  { value: 1, label: "หมอสมชาย" },
  { value: 2, label: "หมอสมหญิง" },
];

function Wrapper() {
  const [value, setValue] = useState(1);
  return (
    <EntityCombobox
      options={options}
      value={value}
      onChange={setValue}
      placeholder="ค้นหา"
      ariaLabel="healer"
    />
  );
}

describe("EntityCombobox", () => {
  it("filters options by typed text and selects a match", async () => {
    render(<Wrapper />);
    const input = screen.getByRole("combobox", { name: /healer/i });
    await userEvent.click(input);
    expect(await screen.findByRole("option", { name: "หมอสมหญิง" })).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "สมหญิง");
    expect(await screen.findByRole("option", { name: "หมอสมหญิง" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "หมอสมชาย" })).toBeNull();

    await userEvent.click(screen.getByRole("option", { name: "หมอสมหญิง" }));
    expect(input).toHaveValue("หมอสมหญิง");
  });
});
