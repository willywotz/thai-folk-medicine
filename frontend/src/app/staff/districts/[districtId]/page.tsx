import { notFound } from "next/navigation";

import { HealerAdminList } from "@/components/HealerAdminList";

export default async function StaffDistrictPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Healers in this district</h1>
      <HealerAdminList districtId={id} />
    </section>
  );
}
