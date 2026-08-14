import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { listRecentRemedies } from "@/lib/api";

export default async function RemediesPage() {
  const remedies = await listRecentRemedies(50);
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "ตำรับยา" }]} />
      <h1 className="mb-4 text-2xl font-bold">ตำรับยา (Remedies)</h1>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <div className="grid gap-3">
          {remedies.map((r) => (
            <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}
    </section>
  );
}
