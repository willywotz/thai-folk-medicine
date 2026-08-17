import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ActivityFeed } from "@/components/ActivityFeed";
import { DashboardStats } from "@/components/DashboardStats";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function StaffDashboardPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const { data: province, isPending } = useQuery({
    queryKey: ["first-province"],
    queryFn: getFirstProvince,
  });

  if (isPending) return <Skeleton className="m-8 h-24" />;

  return (
    <section className="space-y-8">
      <StaffPageHeader
        crumbs={[{ label: t.staff.workspace, href: `/${lang}/staff` }]}
        eyebrow={province ? `${province.nameThai} · ${province.nameEnglish}` : undefined}
        title={t.staff.nav.dashboard}
      />
      <DashboardStats />
      <ActivityFeed />
    </section>
  );
}
