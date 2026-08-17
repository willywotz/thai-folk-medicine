import { useParams } from "react-router-dom";

import { HerbAdminList } from "@/components/HerbAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { useT } from "@/lib/i18n/useT";

export function StaffHerbsPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.crumbHerbs },
        ]}
        eyebrow={t.staff.headers.herbsEyebrow}
        title={t.staff.headers.herbLibrary}
      />
      <p className="-mt-4 mb-6 text-sm text-ink-soft">{t.staff.herbsSharedNote}</p>
      <HerbAdminList />
    </section>
  );
}
