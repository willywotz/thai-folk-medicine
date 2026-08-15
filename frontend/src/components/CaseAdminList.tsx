"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { StaffPagination } from "@/components/StaffPagination";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard, staffField, staffLabel } from "@/components/staff-ui";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { caseListKey, deleteCase, fetchCases } from "@/lib/staff-queries";

export function CaseAdminList({
  remedies,
  remedyId,
}: {
  remedies: { id: number; name: string; healerId: number }[];
  remedyId?: number;
}) {
  const [filterRemedyId, setFilterRemedyId] = useState<number | undefined>(undefined);
  const scopedRemedyId = remedyId ?? filterRemedyId;
  const [page, setPage] = useState(1);
  const [prevRemedyId, setPrevRemedyId] = useState(scopedRemedyId);
  if (scopedRemedyId !== prevRemedyId) {
    setPrevRemedyId(scopedRemedyId);
    setPage(1);
  }

  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: caseListKey(page, scopedRemedyId),
    queryFn: () => fetchCases({ page, remedyId: scopedRemedyId }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseListKey() }),
  });

  const remedyName = (id: number) => remedies.find((r) => r.id === id)?.name ?? "—";

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">Could not load treatment cases.</p>;

  const cases = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {remedyId === undefined ? (
          <div className="flex items-center gap-2">
            <label htmlFor="remedyFilter" className={staffLabel}>
              Remedy
            </label>
            <select
              id="remedyFilter"
              className={staffField}
              value={filterRemedyId ?? ""}
              onChange={(e) => setFilterRemedyId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All remedies</option>
              {remedies.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <span className="text-sm text-ink-faint">
          {data?.total ?? 0} {data?.total === 1 ? "case" : "cases"}
        </span>
        <Link
          href={remedyId !== undefined ? `/staff/cases/new?remedyId=${remedyId}` : "/staff/cases/new"}
          className={btnPrimary}
        >
          <span aria-hidden>+</span> New treatment case
        </Link>
      </div>
      {remove.isError ? <p className="text-sm text-destructive">Could not delete this case.</p> : null}
      {cases.length === 0 ? (
        <EmptyState message="No treatment cases yet." />
      ) : (
        <ul className={staffCard}>
          {cases.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-brand-tint font-serif text-base font-semibold text-brand-strong" aria-hidden>
                {remedyName(c.remedyId).trim().charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                </p>
                {remedyId === undefined ? (
                  <p className="truncate text-sm text-ink-soft">{remedyName(c.remedyId)}</p>
                ) : null}
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
      <StaffPagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}
