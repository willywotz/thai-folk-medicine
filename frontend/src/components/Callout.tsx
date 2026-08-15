import type { ReactNode } from "react";

export function Callout({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "caution";
}) {
  const cls =
    variant === "caution"
      ? "border-caution/40 bg-caution-tint text-ink"
      : "border-brand/30 bg-brand-tint text-ink";
  return <div className={`mt-3.5 rounded-2xl border p-4 text-sm ${cls}`}>{children}</div>;
}
