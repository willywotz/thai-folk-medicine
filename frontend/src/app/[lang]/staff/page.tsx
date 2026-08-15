import { ActivityFeed } from "@/components/ActivityFeed";
import { DashboardStats } from "@/components/DashboardStats";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getFirstProvince } from "@/lib/api";

export default async function StaffDashboard() {
  const t = await getDictionary();
  const province = await getFirstProvince();

  return (
    <section className="space-y-8">
      <StaffPageHeader
        eyebrow={province ? `${province.nameThai} · ${province.nameEnglish}` : undefined}
        title={t.staff.nav.dashboard}
      />
      <DashboardStats />
      <ActivityFeed />
    </section>
  );
}
