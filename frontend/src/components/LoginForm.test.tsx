import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { LoginForm } from "./LoginForm";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fillAndSubmit() {
  return (async () => {
    await userEvent.type(screen.getByLabelText(/username/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
  })();
}

describe("LoginForm", () => {
  it("shows validation errors on empty submit", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
  });

  it("posts credentials and redirects on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch,
    );
    render(<LoginForm />);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff"));
  });

  it("shows an error on bad credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid credentials" }) })) as unknown as typeof fetch,
    );
    render(<LoginForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
