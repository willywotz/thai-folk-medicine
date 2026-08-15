import Link from "next/link";

import { getDictionary } from "@/lib/i18n/getDictionary";

export async function SectionHead({ title, href }: { title: string; href?: string }) {
  const t = await getDictionary();
  return (
    <div className="mb-4 mt-9 flex items-baseline gap-2.5">
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {href ? (
        <Link href={href} className="ml-auto text-sm font-semibold text-brand hover:text-brand-strong">
          {t.common.viewAll}
        </Link>
      ) : null}
    </div>
  );
}
