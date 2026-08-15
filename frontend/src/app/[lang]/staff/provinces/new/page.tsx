import { ProvinceForm } from "@/components/ProvinceForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewProvincePage() {
  const t = await getDictionary();
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: t.staff.nav.dashboard, href: "/staff" }, { label: t.staff.headers.provinces, href: "/staff/provinces" }, { label: t.staff.newProvinceCrumb }]}
        eyebrow={t.staff.headers.provinceNew}
        title={t.staff.addProvinceTitle}
      />
      <ProvinceForm />
    </section>
  );
}
