
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { RowAvatar } from "@/components/RowAvatar";
import { StaffPagination } from "@/components/StaffPagination";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard, staffField, staffLabel } from "@/components/staff-ui";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/useT";
import { caseListKey, deleteCase, fetchCases } from "@/lib/staff-queries";

export function CaseAdminList({
  remedies,
  remedyId,
}: {
  remedies: { id: number; name: string; healerId: number }[];
  remedyId?: number;
}) {
  const t = useT();
  const { lang = "th" } = useParams();
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
  if (isError) return <p className="text-destructive">{t.staff.errorLoadCases}</p>;

  const cases = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {remedyId === undefined ? (
          <div className="flex items-center gap-2">
            <label htmlFor="remedyFilter" className={staffLabel}>
              {t.staff.form.remedy}
            </label>
            <select
              id="remedyFilter"
              className={staffField}
              value={filterRemedyId ?? ""}
              onChange={(e) => setFilterRemedyId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t.staff.allRemedies}</option>
              {remedies.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <span className="text-sm text-ink-faint">{t.staff.count.cases(data?.total ?? 0)}</span>
        <Link
          to={remedyId !== undefined ? `/${lang}/staff/cases/new?remedyId=${remedyId}` : `/${lang}/staff/cases/new`}
          className={btnPrimary}
        >
          <span aria-hidden>+</span> {t.staff.newTreatmentCaseButton}
        </Link>
      </div>
      {remove.isError ? <p className="text-sm text-destructive">{t.staff.errorDeleteCase}</p> : null}
      {cases.length === 0 ? (
        <EmptyState message={t.staff.emptyCases} />
      ) : (
        <ul className={staffCard}>
          {cases.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <RowAvatar ownerType="case" ownerId={c.id} fallback={remedyName(c.remedyId).trim().charAt(0)} />
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
                to={`/${lang}/staff/cases/${c.id}/edit`}
                aria-label={t.staff.editCaseCrumb}
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
                aria-label={t.staff.deleteCaseAria}
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
