import Link from "next/link";

export function DetailHeader({
  titleThai,
  subtitle,
  editHref,
}: {
  titleThai: string;
  subtitle?: string;
  editHref?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl text-ink">{titleThai}</h1>
        {subtitle ? <p className="mt-1 font-serif italic text-ink-soft">{subtitle}</p> : null}
      </div>
      {editHref ? (
        <Link
          href={editHref}
          className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
        >
          ✎ แก้ไข
        </Link>
      ) : null}
    </div>
  );
}
