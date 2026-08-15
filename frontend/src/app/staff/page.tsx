import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function StaffDashboard() {
  const province = await getFirstProvince();
  if (!province) return <EmptyState message="No province data." />;
  const districts = await listDistricts(province.id);

  return (
    <section>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-brand">
        {province.nameThai} · {province.nameEnglish}
      </p>
      <h1 className="mb-2 font-serif text-2xl font-semibold text-ink">
        Choose a district to manage its healers
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Records are organised by district. Open a district to see the folk healers recorded there.
      </p>

      {districts.length === 0 ? (
        <EmptyState message="No districts in this province yet." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {districts.map((d) => (
            <li key={d.id}>
              <Link
                href={`/staff/districts/${d.id}`}
                className="group block rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand"
              >
                <span className="font-serif text-lg font-semibold text-ink">{d.nameThai}</span>
                <span className="mt-0.5 flex items-center justify-between text-sm text-ink-faint">
                  {d.nameEnglish}
                  <span className="text-brand opacity-0 transition group-hover:opacity-100" aria-hidden>
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
