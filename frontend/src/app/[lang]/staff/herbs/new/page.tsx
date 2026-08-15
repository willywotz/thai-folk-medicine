import { HerbForm } from "@/components/HerbForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewHerbPage() {
  const t = await getDictionary();
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: t.staff.nav.dashboard, href: "/staff" }, { label: t.staff.crumbHerbs, href: "/staff/herbs" }, { label: t.staff.newHerbCrumb }]}
        eyebrow={t.staff.headers.herbNew}
        title={t.staff.addHerbTitle}
      />
      <HerbForm />
    </section>
  );
}
