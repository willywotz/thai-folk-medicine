import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { matchesQuery, StaffSearch } from "./StaffSearch";

describe("matchesQuery", () => {
  it("returns true for an empty query", () => {
    expect(matchesQuery("", "anything")).toBe(true);
  });

  it("matches case-insensitively across fields", () => {
    expect(matchesQuery("ไพล", "ขิง", "ไพล เหลือง")).toBe(true);
    expect(matchesQuery("PLAI", undefined, "Plai")).toBe(true);
  });

  it("returns false when no field contains the query", () => {
    expect(matchesQuery("ขมิ้น", "ไพล", "ขิง")).toBe(false);
  });
});

describe("StaffSearch", () => {
  it("reports typed input through onChange", async () => {
    const onChange = vi.fn();
    render(<StaffSearch value="" onChange={onChange} placeholder="Search herbs…" />);
    await userEvent.type(screen.getByPlaceholderText("Search herbs…"), "ก");
    expect(onChange).toHaveBeenCalledWith("ก");
  });
});
