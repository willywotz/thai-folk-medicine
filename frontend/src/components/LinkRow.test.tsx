import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LinkRow } from "./LinkRow";

describe("LinkRow", () => {
  it("renders a titled row link with meta", () => {
    render(<LinkRow href="/remedies/1" title="ยาต้มแก้ไข้" subtitle="ฟ้าทะลายโจร" meta="แก้ไข้" />);
    const link = screen.getByRole("link", { name: /ยาต้มแก้ไข้/ });
    expect(link).toHaveAttribute("href", "/remedies/1");
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
  });
});
