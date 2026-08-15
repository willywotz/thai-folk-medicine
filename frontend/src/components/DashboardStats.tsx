"use client";

import { useQuery } from "@tanstack/react-query";

import { staffCard } from "@/components/staff-ui";
import type { Stats } from "@/lib/api-types";
import { fetchStats, statsKey } from "@/lib/staff-queries";

const TILES: { key: keyof Stats; label: string }[] = [
  { key: "provinces", label: "Provinces" },
  { key: "districts", label: "Districts" },
  { key: "healers", label: "Healers" },
  { key: "remedies", label: "Remedies" },
  { key: "cases", label: "Cases" },
  { key: "herbs", label: "Herbs" },
];

export function DashboardStats() {
  const { data: stats, isLoading, isError } = useQuery({ queryKey: statsKey, queryFn: fetchStats });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load stats.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {TILES.map(({ key, label }) => (
        <li key={key} className={`${staffCard} p-4`}>
          <p className="text-2xl font-semibold text-ink">{stats?.[key] ?? 0}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{label}</p>
        </li>
      ))}
    </ul>
  );
}
