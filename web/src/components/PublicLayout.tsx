import { Outlet } from "react-router-dom";

import { SiteHeader } from "@/components/SiteHeader";

export function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </>
  );
}
