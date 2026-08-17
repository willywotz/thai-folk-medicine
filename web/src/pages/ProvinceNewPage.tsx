import { useParams } from "react-router-dom";

import { ProvinceForm } from "@/components/ProvinceForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { useT } from "@/lib/i18n/useT";

export function ProvinceNewPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.provinces, href: `/${lang}/staff/provinces` },
          { label: t.staff.newProvinceCrumb },
        ]}
        eyebrow={t.staff.headers.provinceNew}
        title={t.staff.addProvinceTitle}
      />
      <ProvinceForm />
    </section>
  );
}
