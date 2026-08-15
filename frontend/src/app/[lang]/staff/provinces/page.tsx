import { ProvinceAdminList } from "@/components/ProvinceAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";

export default function StaffProvincesPage() {
  return (
    <section>
      <StaffPageHeader eyebrow="จังหวัด · locations" title="Provinces" />
      <ProvinceAdminList />
    </section>
  );
}
