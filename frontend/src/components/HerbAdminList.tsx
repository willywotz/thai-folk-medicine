"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard } from "@/components/staff-ui";
import { deleteHerb, fetchHerbs, herbListKey } from "@/lib/staff-queries";

export function HerbAdminList() {
  const queryClient = useQueryClient();
  const { data: herbs, isLoading, isError } = useQuery({ queryKey: herbListKey, queryFn: fetchHerbs });
  const remove = useMutation({
    mutationFn: deleteHerb,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: herbListKey }),
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load herbs.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-faint">
          {herbs?.length ?? 0} {herbs?.length === 1 ? "herb" : "herbs"}
        </span>
        <Link href="/staff/herbs/new" className={btnPrimary}>
          <span aria-hidden>+</span> New herb
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">Could not delete. This herb may still be used by remedies.</p>
      ) : null}
      {!herbs || herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <ul className={staffCard}>
          {herbs.map((h) => (
            <li key={h.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-brand-tint font-serif text-base font-semibold text-brand-strong" aria-hidden>
                {h.nameThai.trim().charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{h.nameThai}</p>
                {h.nameEnglish ? <p className="truncate text-sm text-ink-soft">{h.nameEnglish}</p> : null}
              </div>
              <Link href={`/staff/herbs/${h.id}/edit`} aria-label={`Edit ${h.nameThai}`} className={iconBtn}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(h.id)}
                disabled={remove.isPending}
                aria-label={`Delete ${h.nameThai}`}
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
