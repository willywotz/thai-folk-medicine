import type { ReactNode } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { StaffNavLink } from "@/components/StaffNavLink";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[228px_1fr]">
      <aside className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 md:sticky md:top-20 md:h-fit">
        <div className="flex items-center gap-2.5 px-2 pb-3 pt-1">
          <span className="grid size-8 flex-none place-items-center rounded-lg bg-brand font-serif text-base font-semibold text-white">
            ต
          </span>
          <span className="text-sm font-semibold text-ink">
            ตำรายา
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              Staff workspace
            </span>
          </span>
        </div>

        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          Records
        </p>
        <StaffNavLink href="/staff" match={["/staff/districts", "/staff/healers", "/staff/remedies"]}>
          Districts
        </StaffNavLink>
        <StaffNavLink href="/staff/herbs" match={["/staff/herbs"]}>
          Herbs
        </StaffNavLink>

        <div className="mt-3 border-t border-line pt-3">
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
