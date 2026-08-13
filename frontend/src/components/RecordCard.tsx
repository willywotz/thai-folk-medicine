import Link from "next/link";
import type { ReactNode } from "react";

export function RecordCard({
  href,
  title,
  subtitle,
  children,
}: {
  href: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-400 hover:shadow"
    >
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      {children ? <div className="mt-2 text-sm text-stone-700">{children}</div> : null}
    </Link>
  );
}
