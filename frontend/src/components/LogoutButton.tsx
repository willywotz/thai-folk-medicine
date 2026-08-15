"use client";

import { useRouter } from "next/navigation";

import { useT } from "@/lib/i18n/useT";

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  async function logout() {
    await fetch("/bff/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft hover:border-destructive hover:text-destructive"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M15 12H4m0 0 4-4m-4 4 4 4M15 4h5v16h-5" />
      </svg>
      {t.staff.logout}
    </button>
  );
}
