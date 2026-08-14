import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { firstPhotoUrl, listHerbs } from "@/lib/api";

export default async function HerbsPage() {
  const herbs = await listHerbs();
  const covers = await Promise.all(
    herbs.map((h) => firstPhotoUrl("herb", h.id).catch(() => undefined)),
  );
  return (
    <section>
      <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "สมุนไพร" }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">
        สมุนไพร <span className="text-base text-ink-faint">Herbs</span>
      </h1>
      {herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {herbs.map((h, i) => (
            <RecordCard
              key={h.id}
              href={`/herbs/${h.id}`}
              title={h.nameThai}
              subtitle={h.nameEnglish}
              imageUrl={covers[i]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
