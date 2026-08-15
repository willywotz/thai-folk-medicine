import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function DistrictsPage() {
  const t = await getDictionary();
  const province = await getFirstProvince();
  if (!province) return <EmptyState message="No province data yet." />;
  const districts = await listDistricts(province.id);
  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: "/" }, { label: t.district.crumbList }]} />
      <h1 className="mb-1 font-serif text-2xl text-ink">{province.nameThai}</h1>
      <p className="mb-6 text-ink-soft">{t.district.intro}</p>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {districts.map((d) => (
          <RecordCard key={d.id} href={`/districts/${d.id}`} title={d.nameThai} subtitle={d.nameEnglish} />
        ))}
      </div>
    </section>
  );
}
