import type { ReactNode } from "react";

export function ContentBlock({
  titleThai,
  titleEnglish,
  children,
}: {
  titleThai: string;
  titleEnglish?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-3.5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-1.5 flex items-baseline gap-2 font-serif text-lg text-brand-strong">
        {titleThai}
        {titleEnglish ? <span className="text-xs font-normal text-ink-faint">{titleEnglish}</span> : null}
      </h2>
      <div className="whitespace-pre-line text-ink">{children}</div>
    </section>
  );
}
