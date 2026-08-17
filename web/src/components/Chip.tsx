import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function Chip({
  children,
  href,
  active = false,
}: {
  children: ReactNode;
  href?: string;
  active?: boolean;
}) {
  const cls = active
    ? "bg-brand text-white"
    : "bg-brand-tint text-brand-strong hover:bg-brand hover:text-white";
  const shape = "inline-block rounded-full px-3.5 py-1.5 text-sm transition";
  if (href) {
    return (
      <Link to={href} className={`${shape} ${cls}`}>
        {children}
      </Link>
    );
  }
  return (
    <span className={`${shape} ${cls}`} aria-current={active ? "true" : undefined}>
      {children}
    </span>
  );
}
