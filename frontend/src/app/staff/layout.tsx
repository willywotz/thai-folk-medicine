import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/LogoutButton";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-3">
        <div className="flex items-center gap-4">
          <Link href="/staff" className="font-semibold">
            Staff · Manage records
          </Link>
          <Link href="/staff/herbs" className="text-sm text-stone-600 underline">
            Herbs
          </Link>
        </div>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
