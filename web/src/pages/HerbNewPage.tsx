import { useParams } from "react-router-dom";

import { HerbForm } from "@/components/HerbForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { useT } from "@/lib/i18n/useT";

export function HerbNewPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.crumbHerbs, href: `/${lang}/staff/herbs` },
          { label: t.staff.newHerbCrumb },
        ]}
        eyebrow={t.staff.headers.herbNew}
        title={t.staff.addHerbTitle}
      />
      <HerbForm />
    </section>
  );
}
