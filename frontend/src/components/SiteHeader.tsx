import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n/getDictionary";

export async function SiteHeader() {
  const t = await getDictionary();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="whitespace-nowrap font-serif text-lg font-semibold text-ink">
          ตำรายา<span className="text-brand">พื้นบ้าน</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/staff"
            prefetch={false}
            className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
          >
            {t.nav.forStaff}
          </Link>
        </div>
      </div>
    </header>
  );
}
