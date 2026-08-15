"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard } from "@/components/staff-ui";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { caseListKey, deleteCase, fetchCases } from "@/lib/staff-queries";

export function CaseAdminList({ remedyId }: { remedyId: number }) {
  const queryClient = useQueryClient();
  const { data: cases, isLoading, isError } = useQuery({
    queryKey: caseListKey(remedyId),
    queryFn: () => fetchCases(remedyId),
  });

  const remove = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseListKey(remedyId) }),
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load treatment cases.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-faint">
          {cases?.length ?? 0} {cases?.length === 1 ? "case" : "cases"}
        </span>
        <Link href={`/staff/remedies/${remedyId}/treatment-cases/new`} className={btnPrimary}>
          <span aria-hidden>+</span> New treatment case
        </Link>
      </div>
      {remove.isError ? <p className="text-sm text-destructive">Could not delete this case.</p> : null}
      {!cases || cases.length === 0 ? (
        <EmptyState message="No treatment cases for this remedy yet." />
      ) : (
        <ul className={staffCard}>
          {cases.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                </p>
                {c.result ? <p className="truncate text-sm text-ink-soft">{c.result}</p> : null}
              </div>
              <Link
                href={`/staff/remedies/${remedyId}/treatment-cases/${c.id}/edit`}
                aria-label="Edit case"
                className={iconBtn}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(c.id)}
                disabled={remove.isPending}
                aria-label="Delete case"
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
