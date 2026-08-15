import { HealerForm } from "@/components/HealerForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function NewHealerPage() {
  const t = await getDictionary();
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];
  const districtOptions = districts.map((d) => ({
    value: d.id,
    label: `${d.nameThai} (${d.nameEnglish}) · ${province?.nameThai}`,
  }));

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: t.staff.headers.healers, href: "/staff/healers" }, { label: t.staff.newHealerCrumb }]}
        eyebrow={t.staff.newRecord}
        title={t.staff.addHealerTitle}
      />
      <HealerForm districtOptions={districtOptions} />
    </section>
  );
}
