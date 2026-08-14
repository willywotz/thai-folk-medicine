import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { listHerbs } from "@/lib/api";

export default async function HerbsPage() {
  const herbs = await listHerbs();
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "สมุนไพร" }]} />
      <h1 className="mb-4 text-2xl font-bold">สมุนไพร (Herbs)</h1>
      {herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {herbs.map((h) => (
            <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
          ))}
        </div>
      )}
    </section>
  );
}
