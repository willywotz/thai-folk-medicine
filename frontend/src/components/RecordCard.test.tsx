import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordCard } from "./RecordCard";

describe("RecordCard", () => {
  it("renders a titled link", () => {
    render(<RecordCard href="/healers/1" title="หมอสมชาย" subtitle="สมุนไพร" />);
    const link = screen.getByRole("link", { name: /หมอสมชาย/ });
    expect(link).toHaveAttribute("href", "/healers/1");
    expect(screen.getByText("สมุนไพร")).toBeInTheDocument();
  });

  it("shows a tag when given", () => {
    render(<RecordCard href="/herbs/1" title="ฟ้าทะลายโจร" subtitle="Andrographis" tag="แก้ไข้" />);
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
  });
});
