import type { ReactNode } from "react";

export function ContentBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3.5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-1.5 flex items-baseline gap-2 font-serif text-lg text-brand-strong">{title}</h2>
      <div className="whitespace-pre-line text-ink">{children}</div>
    </section>
  );
}
