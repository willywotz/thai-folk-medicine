import { HealerAdminList } from "@/components/HealerAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function StaffHealersPage() {
  const t = await getDictionary();
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];

  return (
    <section>
      <StaffPageHeader eyebrow={t.staff.headers.healersEyebrow} title={t.staff.headers.healers} />
      <HealerAdminList districts={districts} />
    </section>
  );
}
