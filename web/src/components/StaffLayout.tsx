import { Outlet, useParams } from "react-router-dom";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { StaffNavLink } from "@/components/StaffNavLink";
import { useT } from "@/lib/i18n/useT";
import type { Dictionary } from "@/lib/i18n/dictionaries/th";

type NavItem = {
  href: string;
  match: string[];
  label: (t: Dictionary) => string;
  icon: ReactNode;
};

export function StaffLayout() {
  const t = useT();
  const { lang = "th" } = useParams();
  const p = `/${lang}`;
  const items: NavItem[] = [
    {
      href: `${p}/staff`,
      match: [],
      label: (d) => d.staff.nav.dashboard,
      icon: (
        <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />
      ),
    },
    {
      href: `${p}/staff/provinces`,
      match: [`${p}/staff/provinces`],
      label: (d) => d.staff.nav.province,
      icon: <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
    },
    {
      href: `${p}/staff/healers`,
      match: [`${p}/staff/healers`],
      label: (d) => d.staff.nav.healer,
      icon: (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
        </>
      ),
    },
    {
      href: `${p}/staff/remedies`,
      match: [`${p}/staff/remedies`],
      label: (d) => d.staff.nav.remedy,
      icon: (
        <>
          <path d="M8 3v4M16 3v4" />
          <rect x="5" y="7" width="14" height="14" rx="2" />
          <path d="M9 13h6M9 17h6" />
        </>
      ),
    },
    {
      href: `${p}/staff/cases`,
      match: [`${p}/staff/cases`],
      label: (d) => d.staff.nav.case,
      icon: (
        <>
          <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
          <rect x="5" y="6" width="14" height="15" rx="2" />
          <path d="M9 12h6M9 16h6" />
        </>
      ),
    },
    {
      href: `${p}/staff/herbs`,
      match: [`${p}/staff/herbs`],
      label: (d) => d.staff.nav.herb,
      icon: (
        <path d="M12 21c0-6 4-9 8-10-1 6-4 10-8 10zm0 0c0-6-4-9-8-10 1 6 4 10 8 10zm0-14v3" />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[228px_1fr]">
        <aside className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 md:sticky md:top-20 md:h-fit">
        <div className="flex items-center gap-2.5 px-2 pb-3 pt-1">
          <span className="grid size-8 flex-none place-items-center rounded-lg bg-brand font-serif text-base font-semibold text-white">
            {t.staff.brand[0]}
          </span>
          <span className="text-sm font-semibold text-ink">
            {t.staff.brand}
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              {t.staff.workspace}
            </span>
          </span>
        </div>

        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          {t.staff.nav.records}
        </p>
        {items.map(({ href, match, label, icon }) => (
          <StaffNavLink key={href} href={href} match={match}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              {icon}
            </svg>
            {label(t)}
          </StaffNavLink>
        ))}

        <div className="mt-3 border-t border-line pt-3">
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
