import { Link, useParams } from "react-router-dom";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/useT";

export function SiteHeader() {
  const t = useT();
  const { lang = "th" } = useParams();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link to={`/${lang}`} className="whitespace-nowrap font-serif text-lg font-semibold text-ink">
          ตำรายา<span className="text-brand">พื้นบ้าน</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            to={`/${lang}/staff`}
            className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
          >
            {t.nav.forStaff}
          </Link>
        </div>
      </div>
    </header>
  );
}
