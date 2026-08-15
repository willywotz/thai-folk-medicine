import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { PhotoInput, type PendingPhoto } from "./PhotoInput";

function Wrapper() {
  const [value, setValue] = useState<PendingPhoto[]>([]);
  return (
    <I18nProvider locale="th">
      <PhotoInput value={value} onChange={setValue} />
    </I18nProvider>
  );
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
    await userEvent.upload(screen.getByLabelText("ไฟล์รูปภาพ"), file);
    expect(await screen.findByLabelText("คำบรรยาย")).toHaveValue("");
    expect(screen.getByRole("img", { name: "a.png" })).toBeInTheDocument();
  });

  it("removes a pending row on Remove", async () => {
    render(<Wrapper />);
    const file = new File(["x"], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("ไฟล์รูปภาพ"), file);
    await userEvent.click(screen.getByRole("button", { name: "นำออก" }));
    expect(screen.queryByLabelText("คำบรรยาย")).toBeNull();
  });

  it("fires onChange with edited caption text", async () => {
    render(<Wrapper />);
    const file = new File(["x"], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("ไฟล์รูปภาพ"), file);
    await userEvent.type(screen.getByLabelText("คำบรรยาย"), "root");
    expect(screen.getByLabelText("คำบรรยาย")).toHaveValue("root");
  });
});
