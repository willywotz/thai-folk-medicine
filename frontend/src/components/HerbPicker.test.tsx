import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

function herb(id: number, nameThai: string) {
  return {
    id,
    nameThai,
    nameEnglish: "",
    scientificName: "",
    properties: "",
    description: "",
    createdAt: "",
    updatedAt: "",
  };
}

vi.mock("@/lib/staff-queries", () => ({
  herbListKey: ["herbs"],
  fetchHerbs: vi.fn(async () => [herb(1, "ขิง"), herb(2, "ขมิ้น"), herb(3, "ไพล")]),
}));

import { HerbPicker } from "./HerbPicker";

function Wrapper() {
  const [value, setValue] = useState<{ herbId: number; amount: string }[]>([]);
  return <HerbPicker value={value} onChange={setValue} />;
}

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => vi.clearAllMocks());

describe("HerbPicker", () => {
  it("filters herbs by search text and selects a match", async () => {
    renderWithClient(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: /add herb/i }));

    const input = await screen.findByRole("combobox", { name: /herb/i });
    await userEvent.click(input);
    // All herbs are listed before filtering.
    expect(await screen.findByRole("option", { name: "ขมิ้น" })).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "ไพล");
    // The search narrows the list to the single match.
    expect(await screen.findByRole("option", { name: "ไพล" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "ขมิ้น" })).toBeNull();

    await userEvent.click(screen.getByRole("option", { name: "ไพล" }));
    // The selected herb name fills the search box.
    expect(input).toHaveValue("ไพล");
  });
});
