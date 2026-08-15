import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoInput, type PendingPhoto } from "./PhotoInput";

function Wrapper() {
  const [value, setValue] = useState<PendingPhoto[]>([]);
  return <PhotoInput value={value} onChange={setValue} />;
}

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PhotoInput", () => {
  it("adds a pending row with a caption field when a file is chosen", async () => {
    render(<Wrapper />);
    const file = new File(["x"], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/photo file/i), file);
    expect(await screen.findByLabelText(/caption/i)).toHaveValue("");
    expect(screen.getByRole("img", { name: "a.png" })).toBeInTheDocument();
  });

  it("removes a pending row on Remove", async () => {
    render(<Wrapper />);
    const file = new File(["x"], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/photo file/i), file);
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.queryByLabelText(/caption/i)).toBeNull();
  });

  it("fires onChange with edited caption text", async () => {
    render(<Wrapper />);
    const file = new File(["x"], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/photo file/i), file);
    await userEvent.type(screen.getByLabelText(/caption/i), "root");
    expect(screen.getByLabelText(/caption/i)).toHaveValue("root");
  });
});
