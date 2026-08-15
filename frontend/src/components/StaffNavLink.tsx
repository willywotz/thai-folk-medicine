"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function StaffNavLink({
  href,
  match = [],
  children,
}: {
  href: string;
  match?: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || match.some((p) => pathname.startsWith(p));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium " +
        (active
          ? "bg-brand-tint text-brand-strong"
          : "text-ink-soft hover:bg-surface-2 hover:text-ink")
      }
    >
      {children}
    </Link>
  );
}
