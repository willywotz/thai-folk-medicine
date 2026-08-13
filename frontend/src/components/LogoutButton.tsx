"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/bff/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} className="text-sm text-stone-600 underline">
      Log out
    </button>
  );
}
