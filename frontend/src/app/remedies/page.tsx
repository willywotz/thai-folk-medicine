import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { firstPhotoUrl, listRecentRemedies } from "@/lib/api";

export default async function RemediesPage() {
  const remedies = await listRecentRemedies(50);
  const covers = await Promise.all(
    remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
  );
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "ตำรับยา" }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">
        ตำรับยา <span className="text-base text-ink-faint">Remedies</span>
      </h1>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {remedies.map((r) => (
            <RecordCard
              key={r.id}
              href={`/remedies/${r.id}`}
              title={r.name}
              subtitle={r.symptoms}
              imageUrl={covers[remedies.indexOf(r)]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
