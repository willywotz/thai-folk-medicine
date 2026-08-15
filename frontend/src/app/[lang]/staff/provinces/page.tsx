import { ProvinceAdminList } from "@/components/ProvinceAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function StaffProvincesPage() {
  const t = await getDictionary();
  return (
    <section>
      <StaffPageHeader eyebrow={t.staff.headers.provincesEyebrow} title={t.staff.headers.provinces} />
      <ProvinceAdminList />
    </section>
  );
}
