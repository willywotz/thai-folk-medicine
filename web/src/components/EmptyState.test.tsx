import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the message text", () => {
    const message = "No items found";
    render(<EmptyState message={message} />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("has the correct styling classes", () => {
    const message = "Empty state message";
    const { container } = render(<EmptyState message={message} />);
    const element = container.querySelector("p");

    expect(element).toHaveClass("rounded-lg");
    expect(element).toHaveClass("border");
    expect(element).toHaveClass("border-dashed");
    expect(element).toHaveClass("border-line");
    expect(element).toHaveClass("bg-surface-2");
    expect(element).toHaveClass("p-6");
    expect(element).toHaveClass("text-center");
    expect(element).toHaveClass("text-ink-faint");
  });
});
