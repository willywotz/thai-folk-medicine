import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function HomePage() {
  const province = await getFirstProvince();
  if (!province) {
    return <EmptyState message="No province data yet." />;
  }
  const districts = await listDistricts(province.id);

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold">{province.nameThai}</h1>
      <p className="mb-6 text-stone-500">Choose a district (อำเภอ) to see its healers.</p>
      {districts.length === 0 ? (
        <EmptyState message="No districts yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {districts.map((d) => (
            <RecordCard
              key={d.id}
              href={`/districts/${d.id}`}
              title={d.nameThai}
              subtitle={d.nameEnglish}
            />
          ))}
        </div>
      )}
    </section>
  );
}
