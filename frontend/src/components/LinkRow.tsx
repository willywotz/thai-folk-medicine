import Link from "next/link";
import type { ReactNode } from "react";

export function LinkRow({
  href,
  title,
  subtitle,
  meta,
  icon = "℞",
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-tint font-serif text-brand-strong">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-serif font-semibold text-ink">{title}</span>
        {subtitle ? <span className="block truncate text-sm text-ink-soft">{subtitle}</span> : null}
      </span>
      {meta ? <span className="ml-auto whitespace-nowrap text-right text-sm text-ink-faint">{meta}</span> : null}
    </Link>
  );
}
