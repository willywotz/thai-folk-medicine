import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { LoginForm } from "./LoginForm";

function renderForm() {
  return render(
    <I18nProvider locale="th">
      <LoginForm />
    </I18nProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fillAndSubmit() {
  return (async () => {
    await userEvent.type(screen.getByLabelText("ชื่อผู้ใช้"), "admin");
    await userEvent.type(screen.getByLabelText("รหัสผ่าน"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
  })();
}

describe("LoginForm", () => {
  it("shows validation errors on empty submit", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
  });

  it("posts credentials and redirects on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch,
    );
    renderForm();
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff"));
  });

  it("shows an error on bad credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid credentials" }) })) as unknown as typeof fetch,
    );
    renderForm();
    await fillAndSubmit();
    expect(await screen.findByText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")).toBeInTheDocument();
  });
});
