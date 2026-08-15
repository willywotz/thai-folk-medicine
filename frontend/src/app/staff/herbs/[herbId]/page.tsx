import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { staffCard } from "@/components/staff-ui";
import { getHerb, listRemediesByHerb } from "@/lib/api";

export default async function StaffHerbUsagePage({
  params,
}: {
  params: Promise<{ herbId: string }>;
}) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const herb = await getHerb(id);
  if (!herb) notFound();
  const remedies = await listRemediesByHerb(id, { pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Herbs", href: "/staff/herbs" }, { label: herb.nameThai }]}
        eyebrow="สมุนไพร · used in"
        title={`Remedies using ${herb.nameThai}`}
      />
      {remedies.items.length === 0 ? (
        <EmptyState message="No remedies use this herb yet." />
      ) : (
        <ul className={staffCard}>
          {remedies.items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0 hover:bg-surface-2">
              <p className="min-w-0 flex-1 truncate font-medium text-ink">{r.name}</p>
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
    </section>
  );
}
