import { Link } from "react-router-dom";

import { useT } from "@/lib/i18n/useT";

export function SectionHead({ title, href }: { title: string; href?: string }) {
  const t = useT();
  return (
    <div className="mb-4 mt-9 flex items-baseline gap-2.5">
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {href ? (
        <Link to={href} className="ml-auto text-sm font-semibold text-brand hover:text-brand-strong">
          {t.common.viewAll}
        </Link>
      ) : null}
    </div>
  );
}
