import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";
import { getHealer } from "@/lib/api";

export default async function EditHealerPage({
  params,
}: {
  params: Promise<{ districtId: string; healerId: string }>;
}) {
  const { districtId, healerId } = await params;
  const dId = Number(districtId);
  const hId = Number(healerId);
  if (!Number.isInteger(dId) || dId <= 0 || !Number.isInteger(hId) || hId <= 0) notFound();

  const healer = await getHealer(hId);
  if (!healer) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit healer</h1>
      <HealerForm districtId={dId} healer={healer} />
    </section>
  );
}
