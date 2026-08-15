import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDistrict } from "@/lib/api";

export default async function NewHealerPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const district = await getDistrict(id);

  const crumbs = [
    { label: "Districts", href: "/staff" },
    ...(district ? [{ label: district.nameThai, href: `/staff/districts/${id}` }] : []),
    { label: "New healer" },
  ];

  return (
    <section>
      <StaffPageHeader crumbs={crumbs} eyebrow="new record" title="Add a folk healer" />
      <HealerForm districtId={id} />
    </section>
  );
}
