import { notFound } from "next/navigation";

import { HerbForm } from "@/components/HerbForm";
import { PhotoManager } from "@/components/PhotoManager";
import { getHerb } from "@/lib/api";

export default async function EditHerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const herb = await getHerb(id);
  if (!herb) notFound();
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit herb</h1>
      <HerbForm herb={herb} />
      <div className="mt-8">
        <PhotoManager ownerType="herb" ownerId={herb.id} />
      </div>
    </section>
  );
}
