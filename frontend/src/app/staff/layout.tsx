import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/LogoutButton";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-3">
        <Link href="/staff" className="font-semibold">
          Staff · Manage records
        </Link>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
