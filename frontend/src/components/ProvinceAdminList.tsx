"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { matchesQuery, StaffSearch } from "@/components/StaffSearch";
import { btnPrimary, iconBtn, iconBtnDanger, linkAction, staffCard } from "@/components/staff-ui";
import { deleteProvince, fetchProvinces, provinceListKey } from "@/lib/staff-queries";

export function ProvinceAdminList() {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const { data: provinces, isLoading, isError } = useQuery({
    queryKey: provinceListKey,
    queryFn: fetchProvinces,
  });

  const remove = useMutation({
    mutationFn: deleteProvince,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: provinceListKey }),
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load provinces.</p>;

  const shown = (provinces ?? []).filter((p) => matchesQuery(query, p.nameThai, p.nameEnglish));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StaffSearch value={query} onChange={setQuery} placeholder="Search provinces…" />
        <span className="text-sm text-ink-faint">
          {shown.length} {shown.length === 1 ? "province" : "provinces"}
        </span>
        <Link href="/staff/provinces/new" className={btnPrimary}>
          <span aria-hidden>+</span> New province
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">This province still has districts. Delete them first.</p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState message="No provinces yet." />
      ) : (
        <ul className={staffCard}>
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-brand-tint font-serif text-base font-semibold text-brand-strong" aria-hidden>
                {p.nameThai.trim().charAt(0)}
              </span>
              <Link href={`/staff/provinces/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{p.nameThai}</p>
                {p.nameEnglish ? <p className="truncate text-sm text-ink-soft">{p.nameEnglish}</p> : null}
              </Link>
              <Link href={`/staff/provinces/${p.id}`} className={linkAction}>
                Districts
              </Link>
              <Link href={`/staff/provinces/${p.id}/edit`} aria-label={`Edit ${p.nameThai}`} className={iconBtn}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(p.id)}
                disabled={remove.isPending}
                aria-label={`Delete ${p.nameThai}`}
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
