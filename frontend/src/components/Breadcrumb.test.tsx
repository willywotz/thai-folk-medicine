import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("links every item except the last", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Kut Chum", href: "/districts/1" },
          { label: "หมอสมชาย" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Kut Chum" })).toHaveAttribute("href", "/districts/1");
    expect(screen.queryByRole("link", { name: "หมอสมชาย" })).toBeNull();
  });
});
