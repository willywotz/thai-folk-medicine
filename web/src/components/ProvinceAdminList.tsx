
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { RowAvatar } from "@/components/RowAvatar";
import { matchesQuery, StaffSearch } from "@/components/StaffSearch";
import { btnPrimary, iconBtn, iconBtnDanger, linkAction, staffCard } from "@/components/staff-ui";
import { useT } from "@/lib/i18n/useT";
import { deleteProvince, fetchProvinces, provinceListKey } from "@/lib/staff-queries";

export function ProvinceAdminList() {
  const t = useT();
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
  if (isError) return <p className="text-destructive">{t.staff.errorLoadProvinces}</p>;

  const shown = (provinces ?? []).filter((p) => matchesQuery(query, p.nameThai, p.nameEnglish));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StaffSearch value={query} onChange={setQuery} placeholder={t.staff.searchProvinces} />
        <span className="text-sm text-ink-faint">{t.staff.count.provinces(shown.length)}</span>
        <Link to="/staff/provinces/new" className={btnPrimary}>
          <span aria-hidden>+</span> {t.staff.newProvinceCrumb}
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">{t.staff.errorProvinceHasDistricts}</p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState message={t.staff.emptyProvinces} />
      ) : (
        <ul className={staffCard}>
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <RowAvatar ownerType="province" ownerId={p.id} fallback={p.nameThai.trim().charAt(0)} />
              <Link to={`/staff/provinces/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{p.nameThai}</p>
                {p.nameEnglish ? <p className="truncate text-sm text-ink-soft">{p.nameEnglish}</p> : null}
              </Link>
              <Link to={`/staff/provinces/${p.id}`} className={linkAction}>
                {t.staff.link.districts}
              </Link>
              <Link to={`/staff/provinces/${p.id}/edit`} aria-label={t.staff.editName(p.nameThai)} className={iconBtn}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(p.id)}
                disabled={remove.isPending}
                aria-label={t.staff.deleteName(p.nameThai)}
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
