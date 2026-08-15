"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { matchesQuery, StaffSearch } from "@/components/StaffSearch";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard } from "@/components/staff-ui";
import type { Healer } from "@/lib/api-types";
import { deleteRemedy, fetchRemedies, remedyListKey } from "@/lib/staff-queries";

export function RemedyAdminList({ healers }: { healers: Pick<Healer, "id" | "fullName">[] }) {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const { data: remedies, isLoading, isError } = useQuery({
    queryKey: remedyListKey(),
    queryFn: () => fetchRemedies(),
  });

  const remove = useMutation({
    mutationFn: deleteRemedy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remedyListKey() }),
  });

  const healerName = (id: number) => healers.find((h) => h.id === id)?.fullName ?? "—";

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load remedies.</p>;

  const shown = (remedies ?? []).filter((r) => matchesQuery(query, r.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StaffSearch value={query} onChange={setQuery} placeholder="Search remedies…" />
        </div>
        <span className="text-sm text-ink-faint">
          {shown.length} {shown.length === 1 ? "remedy" : "remedies"}
        </span>
        <Link href="/staff/remedies/new" className={btnPrimary}>
          <span aria-hidden>+</span> New remedy
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">
          Could not delete this remedy. It may still have treatment cases.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <ul className={staffCard}>
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-brand-tint font-serif text-base font-semibold text-brand-strong" aria-hidden>
                {r.name.trim().charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.name}</p>
                <p className="truncate text-sm text-ink-soft">{healerName(r.healerId)}</p>
              </div>
              <Link
                href={`/staff/remedies/${r.id}/edit`}
                aria-label={`Edit ${r.name}`}
                className={iconBtn}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(r.id)}
                disabled={remove.isPending}
                aria-label={`Delete ${r.name}`}
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
