import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, getHealer, listDistricts } from "@/lib/api";

export default async function EditHealerPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Healers", href: "/staff/healers" }, { label: healer.fullName }]}
        eyebrow="edit record"
        title={`Edit ${healer.fullName}`}
      />
      <HealerForm healer={healer} districts={districts} />
    </section>
  );
}
