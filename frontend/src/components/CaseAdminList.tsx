"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard, staffField, staffLabel } from "@/components/staff-ui";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { caseListKey, deleteCase, fetchCases } from "@/lib/staff-queries";

export function CaseAdminList({ remedies }: { remedies: { id: number; name: string; healerId: number }[] }) {
  const [remedyId, setRemedyId] = useState<number | undefined>(undefined);
  const queryClient = useQueryClient();
  const { data: cases, isLoading, isError } = useQuery({
    queryKey: caseListKey(remedyId),
    queryFn: () => fetchCases(remedyId),
  });

  const remove = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseListKey(remedyId) }),
  });

  const remedyName = (id: number) => remedies.find((r) => r.id === id)?.name ?? "—";

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load treatment cases.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="remedyFilter" className={staffLabel}>
            Remedy
          </label>
          <select
            id="remedyFilter"
            className={staffField}
            value={remedyId ?? ""}
            onChange={(e) => setRemedyId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All remedies</option>
            {remedies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-ink-faint">
          {cases?.length ?? 0} {cases?.length === 1 ? "case" : "cases"}
        </span>
        <Link href="/staff/cases/new" className={btnPrimary}>
          <span aria-hidden>+</span> New treatment case
        </Link>
      </div>
      {remove.isError ? <p className="text-sm text-destructive">Could not delete this case.</p> : null}
      {!cases || cases.length === 0 ? (
        <EmptyState message="No treatment cases yet." />
      ) : (
        <ul className={staffCard}>
          {cases.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                </p>
                <p className="truncate text-sm text-ink-soft">{remedyName(c.remedyId)}</p>
                {c.result ? <p className="truncate text-sm text-ink-soft">{c.result}</p> : null}
              </div>
              <Link
                href={`/staff/cases/${c.id}/edit`}
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
