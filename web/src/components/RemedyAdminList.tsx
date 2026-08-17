
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { RowAvatar } from "@/components/RowAvatar";
import { StaffPagination } from "@/components/StaffPagination";
import { StaffSearch } from "@/components/StaffSearch";
import { btnPrimary, iconBtn, iconBtnDanger, linkAction, staffCard } from "@/components/staff-ui";
import type { Healer } from "@/lib/api-types";
import { useT } from "@/lib/i18n/useT";
import { deleteRemedy, fetchRemedies, remedyListKey } from "@/lib/staff-queries";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 300;

export function RemedyAdminList({
  healers,
  healerId,
}: {
  healers: Pick<Healer, "id" | "fullName">[];
  healerId?: number;
}) {
  const t = useT();
  const { lang = "th" } = useParams();
  const [input, setInput] = useState("");
  const searchTerm = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [prevSearchTerm, setPrevSearchTerm] = useState(searchTerm);
  if (searchTerm !== prevSearchTerm) {
    setPrevSearchTerm(searchTerm);
    setPage(1);
  }

  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: remedyListKey(page, searchTerm, healerId),
    queryFn: () => fetchRemedies({ page, searchTerm, healerId }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: deleteRemedy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remedyListKey() }),
  });

  const healerName = (id: number) => healers.find((h) => h.id === id)?.fullName ?? "—";

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">{t.staff.errorLoadRemedies}</p>;

  const remedies = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StaffSearch value={input} onChange={setInput} placeholder={t.staff.searchRemediesList} />
        </div>
        <span className="text-sm text-ink-faint">{t.staff.count.remedies(data?.total ?? 0)}</span>
        <Link
          to={healerId !== undefined ? `/${lang}/staff/remedies/new?healerId=${healerId}` : `/${lang}/staff/remedies/new`}
          className={btnPrimary}
        >
          <span aria-hidden>+</span> {t.staff.newRemedyCrumb}
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">{t.staff.errorDeleteRemedy}</p>
      ) : null}
      {remedies.length === 0 ? (
        <EmptyState message={t.staff.emptyRemedies} />
      ) : (
        <ul className={staffCard}>
          {remedies.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <RowAvatar ownerType="remedy" ownerId={r.id} fallback={r.name.trim().charAt(0)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.name}</p>
                {healerId === undefined ? (
                  <p className="truncate text-sm text-ink-soft">{healerName(r.healerId)}</p>
                ) : null}
              </div>
              <Link to={`/${lang}/staff/remedies/${r.id}/treatment-cases`} className={linkAction}>
                {t.staff.link.cases}
              </Link>
              <Link
                to={`/${lang}/staff/remedies/${r.id}/edit`}
                aria-label={t.staff.editName(r.name)}
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
                aria-label={t.staff.deleteName(r.name)}
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
