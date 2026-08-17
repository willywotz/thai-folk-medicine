
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { RowAvatar } from "@/components/RowAvatar";
import { btnPrimary, iconBtn, iconBtnDanger, staffCard } from "@/components/staff-ui";
import { useT } from "@/lib/i18n/useT";
import { deleteDistrict, districtListKey, fetchDistricts } from "@/lib/staff-queries";

export function DistrictAdminList({ provinceId }: { provinceId: number }) {
  const t = useT();
  const { lang = "th" } = useParams();
  const queryClient = useQueryClient();

  const key = districtListKey(provinceId);
  const { data: districts, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => fetchDistricts(provinceId),
  });

  const remove = useMutation({
    mutationFn: deleteDistrict,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">{t.staff.errorLoadDistricts}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-faint">{t.staff.count.districts(districts?.length ?? 0)}</span>
        <Link to={`/${lang}/staff/provinces/${provinceId}/districts/new`} className={btnPrimary}>
          <span aria-hidden>+</span> {t.staff.newDistrictButton}
        </Link>
      </div>
      {remove.isError ? (
        <p className="text-sm text-destructive">{t.staff.errorDistrictHasHealers}</p>
      ) : null}
      {!districts || districts.length === 0 ? (
        <EmptyState message={t.staff.emptyDistricts} />
      ) : (
        <ul className={staffCard}>
          {districts.map((d) => (
            <li key={d.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <RowAvatar ownerType="district" ownerId={d.id} fallback={d.nameThai.trim().charAt(0)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{d.nameThai}</p>
                {d.nameEnglish ? <p className="truncate text-sm text-ink-soft">{d.nameEnglish}</p> : null}
              </div>
              <Link
                to={`/${lang}/staff/provinces/${provinceId}/districts/${d.id}/edit`}
                aria-label={t.staff.editName(d.nameThai)}
                className={iconBtn}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate(d.id)}
                disabled={remove.isPending}
                aria-label={t.staff.deleteName(d.nameThai)}
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
