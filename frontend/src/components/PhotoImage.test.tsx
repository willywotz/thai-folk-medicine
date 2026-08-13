import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhotoImage } from "./PhotoImage";

describe("PhotoImage", () => {
  it("points at the proxied photo path with alt text", () => {
    render(<PhotoImage photoId={7} alt="ต้นสมุนไพร" />);
    const img = screen.getByAltText("ต้นสมุนไพร");
    expect(img).toHaveAttribute("src", "/api/v1/photos/7");
  });
});
