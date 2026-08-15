import Link from "next/link";

export function SectionHead({
  titleThai,
  titleEnglish,
  href,
}: {
  titleThai: string;
  titleEnglish?: string;
  href?: string;
}) {
  return (
    <div className="mb-4 mt-9 flex items-baseline gap-2.5">
      <h2 className="font-serif text-xl text-ink">{titleThai}</h2>
      {titleEnglish ? <span className="text-sm text-ink-faint">{titleEnglish}</span> : null}
      {href ? (
        <Link href={href} className="ml-auto text-sm font-semibold text-brand hover:text-brand-strong">
          ดูทั้งหมด →
        </Link>
      ) : null}
    </div>
  );
}
