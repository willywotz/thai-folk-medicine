"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { matchesQuery, StaffSearch } from "@/components/StaffSearch";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard } from "@/components/staff-ui";
import type { District } from "@/lib/api-types";
import { deleteHealer, fetchHealers, healerListKey } from "@/lib/staff-queries";

export function HealerAdminList({ districts }: { districts: District[] }) {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const { data: healers, isLoading, isError } = useQuery({
    queryKey: healerListKey(),
    queryFn: () => fetchHealers(),
  });

  const remove = useMutation({
    mutationFn: deleteHealer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healerListKey() }),
  });

  const districtName = (id: number) => {
    const district = districts.find((d) => d.id === id);
    return district ? `${district.nameEnglish} · ${district.nameThai}` : "—";
  };

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load healers.</p>;

  const shown = (healers ?? []).filter((h) => matchesQuery(query, h.fullName, h.specialty));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StaffSearch value={query} onChange={setQuery} placeholder="Search healers…" />
        </div>
        <span className="text-sm text-ink-faint">
          {shown.length} {shown.length === 1 ? "healer" : "healers"}
        </span>
        <Link href="/staff/healers/new" className={btnPrimary}>
          <span aria-hidden>+</span> New healer
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">
          Could not delete this healer. It may still have remedies or cases.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState message="No healers yet." />
      ) : (
        <ul className={staffCard}>
          {shown.map((h) => (
            <li key={h.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-brand-tint font-serif text-base font-semibold text-brand-strong" aria-hidden>
                {h.fullName.trim().charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{h.fullName}</p>
                <p className="truncate text-sm text-ink-soft">
                  {districtName(h.districtId)}
                  {h.specialty ? ` · ${h.specialty}` : ""}
                </p>
              </div>
              <Link
                href={`/staff/healers/${h.id}/edit`}
                aria-label={`Edit ${h.fullName}`}
                className={iconBtn}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(h.id)}
                disabled={remove.isPending}
                aria-label={`Delete ${h.fullName}`}
                className={iconBtnDanger}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
