"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { btnPrimary, iconBtn, iconBtnDanger, linkAction, staffCard } from "@/components/staff-ui";
import { deleteRemedy, fetchRemedies, remedyListKey } from "@/lib/staff-queries";

export function RemedyAdminList({ healerId }: { healerId: number }) {
  const queryClient = useQueryClient();
  const { data: remedies, isLoading, isError } = useQuery({
    queryKey: remedyListKey(healerId),
    queryFn: () => fetchRemedies(healerId),
  });

  const remove = useMutation({
    mutationFn: deleteRemedy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remedyListKey(healerId) }),
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load remedies.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-faint">
          {remedies?.length ?? 0} {remedies?.length === 1 ? "remedy" : "remedies"}
        </span>
        <Link href={`/staff/healers/${healerId}/remedies/new`} className={btnPrimary}>
          <span aria-hidden>+</span> New remedy
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">
          Could not delete this remedy. It may still have treatment cases.
        </p>
      ) : null}
      {!remedies || remedies.length === 0 ? (
        <EmptyState message="No remedies for this healer yet." />
      ) : (
        <ul className={staffCard}>
          {remedies.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <p className="min-w-0 flex-1 truncate font-medium text-ink">{r.name}</p>
              <Link href={`/staff/remedies/${r.id}/treatment-cases`} className={linkAction}>
                Cases
              </Link>
              <Link
                href={`/staff/healers/${healerId}/remedies/${r.id}/edit`}
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
