import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RowAvatar } from "@/components/RowAvatar";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { staffCard } from "@/components/staff-ui";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getFirstProvince, getHerb, listDistricts, listHealers, listRemediesByHerb } from "@/lib/api";

const PAGE_SIZE = 20;

export default async function StaffHerbUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ herbId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getDictionary();
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const herb = await getHerb(id);
  if (!herb) notFound();
  const remedies = await listRemediesByHerb(id, { page, pageSize: PAGE_SIZE });

  // Resolve each remedy's ancestry (healer -> district -> province) for the row.
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];
  const healers = (await listHealers({ pageSize: 48 })).items; // withinlazy: pageSize=48 caps the lookup
  const districtName = (districtId: number) =>
    districts.find((d) => d.id === districtId)?.nameThai ?? "—";
  const ancestry = (healerId: number) => {
    const healer = healers.find((h) => h.id === healerId);
    if (!healer) return "—";
    return `${healer.fullName} · ${districtName(healer.districtId)} · ${province?.nameThai ?? "—"}`;
  };

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: t.staff.crumbHerbs, href: "/staff/herbs" }, { label: herb.nameThai }]}
        eyebrow={t.staff.headers.herbUsedIn}
        title={t.staff.usedInName(herb.nameThai)}
      />
      {remedies.items.length === 0 ? (
        <EmptyState message={t.staff.emptyRemediesForHerb} />
      ) : (
        <ul className={staffCard}>
          {remedies.items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <RowAvatar ownerType="remedy" ownerId={r.id} fallback={r.name.trim().charAt(0)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.name}</p>
                <p className="truncate text-sm text-ink-soft">{ancestry(r.healerId)}</p>
              </div>
              <Link
                href={`/staff/remedies/${r.id}/edit`}
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
          basePath={`/staff/herbs/${id}`}
          searchParams={{}}
        />
      </div>
    </section>
  );
}
