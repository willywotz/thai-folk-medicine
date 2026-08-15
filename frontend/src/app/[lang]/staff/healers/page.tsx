import { HealerAdminList } from "@/components/HealerAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function StaffHealersPage() {
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];

  return (
    <section>
      <StaffPageHeader eyebrow="หมอพื้นบ้าน · folk healers" title="Healers" />
      <HealerAdminList districts={districts} />
    </section>
  );
}
