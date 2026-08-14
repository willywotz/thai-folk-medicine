import type { ReactNode } from "react";

export function FactPanel({
  title,
  facts,
}: {
  title: string;
  facts: { key: string; value: ReactNode }[];
}) {
  const shown = facts.filter((f) => f.value !== "" && f.value != null);
  if (shown.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-faint">
        {title}
      </div>
      <dl className="px-4 py-1.5">
        {shown.map((f) => (
          <div key={f.key} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
            <dt className="text-ink-soft">{f.key}</dt>
            <dd className="text-right font-medium text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
