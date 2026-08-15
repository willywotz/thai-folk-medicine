import { ProvinceForm } from "@/components/ProvinceForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewProvincePage() {
  const t = await getDictionary();
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Provinces", href: "/staff/provinces" }, { label: "New province" }]}
        eyebrow={t.staff.headers.provinceNew}
        title="Add a province"
      />
      <ProvinceForm />
    </section>
  );
}
