import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders a link chip when href is set", () => {
    render(<Chip href="/districts">ยโสธร</Chip>);
    expect(screen.getByRole("link", { name: "ยโสธร" })).toHaveAttribute("href", "/districts");
  });
  it("marks the active chip", () => {
    render(<Chip active>ทั้งหมด</Chip>);
    expect(screen.getByText("ทั้งหมด")).toHaveAttribute("aria-current", "true");
  });
});
