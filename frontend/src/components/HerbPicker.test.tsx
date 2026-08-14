import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/staff-queries", () => ({
  herbListKey: ["herbs"],
  fetchHerbs: vi.fn(async () => [
    {
      id: 1,
      nameThai: "ขิง",
      nameEnglish: "Ginger",
      scientificName: "",
      properties: "",
      description: "",
      createdAt: "",
      updatedAt: "",
    },
  ]),
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
  it("shows the herb options after adding a row", async () => {
    renderWithClient(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: /add herb/i }));
    expect(await screen.findByText("ขิง")).toBeInTheDocument();
  });
});
