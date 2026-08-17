import { useParams } from "react-router-dom";

import { ProvinceAdminList } from "@/components/ProvinceAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { useT } from "@/lib/i18n/useT";

export function ProvincesPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: t.staff.nav.dashboard, href: `/${lang}/staff` }, { label: t.staff.headers.provinces }]}
        eyebrow={t.staff.headers.provincesEyebrow}
        title={t.staff.headers.provinces}
      />
      <ProvinceAdminList />
    </section>
  );
}
