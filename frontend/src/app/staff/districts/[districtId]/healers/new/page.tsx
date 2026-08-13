import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";

export default async function NewHealerPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">New healer</h1>
      <HealerForm districtId={id} />
    </section>
  );
}
