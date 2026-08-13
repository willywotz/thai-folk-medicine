import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function StaffDashboard() {
  const province = await getFirstProvince();
  if (!province) return <EmptyState message="No province data." />;
  const districts = await listDistricts(province.id);

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Choose a district to manage its healers</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {districts.map((d) => (
          <li key={d.id}>
            <Link
              href={`/staff/districts/${d.id}`}
              className="block rounded border border-stone-200 bg-white p-3 hover:border-stone-400"
            >
              {d.nameThai} <span className="text-stone-500">· {d.nameEnglish}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
