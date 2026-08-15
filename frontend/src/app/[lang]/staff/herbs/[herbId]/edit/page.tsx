import { notFound } from "next/navigation";

import { HerbForm } from "@/components/HerbForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getHerb } from "@/lib/api";

export default async function EditHerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const t = await getDictionary();
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const herb = await getHerb(id);
  if (!herb) notFound();
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: t.staff.nav.dashboard, href: "/staff" }, { label: t.staff.crumbHerbs, href: "/staff/herbs" }, { label: herb.nameThai }]}
        eyebrow={t.staff.headers.herbEdit}
        title={t.staff.editName(herb.nameThai)}
      />
      <HerbForm herb={herb} />
    </section>
  );
}
