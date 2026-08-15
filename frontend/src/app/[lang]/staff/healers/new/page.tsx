import { HealerForm } from "@/components/HealerForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function NewHealerPage() {
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];
  const districtOptions = districts.map((d) => ({
    value: d.id,
    label: `${d.nameThai} (${d.nameEnglish}) · ${province?.nameThai}`,
  }));

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Healers", href: "/staff/healers" }, { label: "New healer" }]}
        eyebrow="new record"
        title="Add a folk healer"
      />
      <HealerForm districtOptions={districtOptions} />
    </section>
  );
}
