"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { hasLocale, locales, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/useT";

export function swapLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if (hasLocale(segments[1] ?? "")) {
    segments[1] = target;
    return segments.join("/") || "/";
  }
  return `/${target}${pathname === "/" ? "" : pathname}`;
}

export function LanguageSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 text-sm" aria-label="Language">
      {locales.map((l) => (
        <Link
          key={l}
          href={swapLocalePath(pathname, l)}
          aria-current={l === current ? "true" : undefined}
          className={l === current ? "font-semibold text-brand" : "text-ink-faint hover:text-brand"}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
