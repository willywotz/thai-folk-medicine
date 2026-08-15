import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

import { PhotoManager } from "./PhotoManager";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="th">{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PhotoManager", () => {
  it("shows existing photos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [{ id: 7, ownerType: "healer", ownerId: 2, caption: "ต้นยา" }] })) as unknown as typeof fetch,
    );
    renderWithClient(<PhotoManager ownerType="healer" ownerId={2} />);
    const img = await screen.findByAltText(/ต้นยา|photo/i);
    expect(img).toHaveAttribute("src", "/api/v1/photos/7");
  });

  it("uploads a chosen file", async () => {
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (opts?.method === "POST") return { ok: true, status: 201, json: async () => ({ id: 9 }) };
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<PhotoManager ownerType="healer" ownerId={2} />);

    const file = new File(["bytes"], "p.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("ไฟล์รูปภาพ"), file);
    await userEvent.click(screen.getByRole("button", { name: "อัปโหลด" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/photos", expect.objectContaining({ method: "POST" })),
    );
  });
});
