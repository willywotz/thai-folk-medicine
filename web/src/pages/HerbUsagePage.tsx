import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { NotFound } from "@/components/NotFound";
import { Pagination } from "@/components/Pagination";
import { RowAvatar } from "@/components/RowAvatar";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { staffCard } from "@/components/staff-ui";
import { getHerb, listRemediesByHerb } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

const PAGE_SIZE = 20;

export function HerbUsagePage() {
  const t = useT();
  const { lang = "th", herbId } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;
  const id = Number(herbId);

  const { data, isPending } = useQuery({
    queryKey: ["herb-usage", id, page],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async () => {
      const herb = await getHerb(id);
      if (!herb) return null;
      const remedies = await listRemediesByHerb(id, { page, pageSize: PAGE_SIZE });
      return { herb, remedies };
    },
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (!data) return <NotFound />;
  const { herb, remedies } = data;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.crumbHerbs, href: `/${lang}/staff/herbs` },
          { label: herb.nameThai },
        ]}
        eyebrow={t.staff.headers.herbUsedIn}
        title={t.staff.usedInName(herb.nameThai)}
      />
      {remedies.items.length === 0 ? (
        <EmptyState message={t.staff.emptyRemediesForHerb} />
      ) : (
        <ul className={staffCard}>
          {remedies.items.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2"
            >
              <RowAvatar ownerType="remedy" ownerId={r.id} fallback={r.name.trim().charAt(0)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.name}</p>
              </div>
              <Link
                to={`/${lang}/staff/remedies/${r.id}/edit`}
                className="text-sm font-semibold text-brand hover:text-brand-strong"
              >
                Open →
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Pagination
          page={remedies.page}
          totalPages={remedies.totalPages}
          basePath={`/${lang}/staff/herbs/${id}`}
          searchParams={{}}
        />
      </div>
    </section>
  );
}
