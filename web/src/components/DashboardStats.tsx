"use client";

import { useQuery } from "@tanstack/react-query";

import { staffCard } from "@/components/staff-ui";
import type { Stats } from "@/lib/api-types";
import type { Dictionary } from "@/lib/i18n/dictionaries/th";
import { useT } from "@/lib/i18n/useT";
import { fetchStats, statsKey } from "@/lib/staff-queries";

const TILES: { key: keyof Stats; label: (t: Dictionary) => string }[] = [
  { key: "provinces", label: (t) => t.staff.headers.provinces },
  { key: "districts", label: (t) => t.staff.dashboard.tileDistricts },
  { key: "healers", label: (t) => t.staff.headers.healers },
  { key: "remedies", label: (t) => t.staff.headers.remedies },
  { key: "cases", label: (t) => t.staff.dashboard.tileCases },
  { key: "herbs", label: (t) => t.staff.crumbHerbs },
];

export function DashboardStats() {
  const t = useT();
  const { data: stats, isLoading, isError } = useQuery({ queryKey: statsKey, queryFn: fetchStats });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">{t.staff.dashboard.loadError}</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {TILES.map(({ key, label }) => (
        <li key={key} className={`${staffCard} p-4`}>
          <p className="text-2xl font-semibold text-ink">{stats?.[key] ?? 0}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{label(t)}</p>
        </li>
      ))}
    </ul>
  );
}
