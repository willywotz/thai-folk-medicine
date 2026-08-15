import { notFound } from "next/navigation";

import { RemedyAdminList } from "@/components/RemedyAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDistrict, getHealer } from "@/lib/api";

export default async function StaffRemediesPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();
  const district = await getDistrict(healer.districtId);

  const crumbs = [
    { label: "Districts", href: "/staff" },
    ...(district
      ? [{ label: district.nameThai, href: `/staff/districts/${district.id}` }]
      : []),
    { label: healer.fullName },
  ];

  return (
    <section>
      <StaffPageHeader crumbs={crumbs} eyebrow={`Remedies of ${healer.fullName}`} title="ตำรับยา · Remedies" />
      <RemedyAdminList healerId={id} />
    </section>
  );
}
