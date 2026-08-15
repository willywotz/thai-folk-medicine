import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";
import { PhotoManager } from "@/components/PhotoManager";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDistrict, getHealer } from "@/lib/api";

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
  const district = await getDistrict(dId);

  const crumbs = [
    { label: "Districts", href: "/staff" },
    ...(district ? [{ label: district.nameThai, href: `/staff/districts/${dId}` }] : []),
    { label: healer.fullName },
  ];

  return (
    <section>
      <StaffPageHeader crumbs={crumbs} eyebrow="edit record" title={`Edit ${healer.fullName}`} />
      <HealerForm districtId={dId} healer={healer} />
      <div className="mt-8">
        <PhotoManager ownerType="healer" ownerId={healer.id} />
      </div>
    </section>
  );
}
