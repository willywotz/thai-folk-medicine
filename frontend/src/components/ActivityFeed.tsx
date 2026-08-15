"use client";

import { useQuery } from "@tanstack/react-query";

import { staffCard } from "@/components/staff-ui";
import { formatActivity } from "@/lib/activity-format";
import { useT } from "@/lib/i18n/useT";
import { activityKey, fetchActivity } from "@/lib/staff-queries";

export function ActivityFeed() {
  const t = useT();
  const { data: activity, isLoading, isError } = useQuery({
    queryKey: activityKey,
    queryFn: fetchActivity,
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;
  if (isError) return <p className="text-destructive">{t.staff.dashboard.activityLoadError}</p>;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-ink">{t.staff.dashboard.activityHeading}</h2>
      {!activity || activity.length === 0 ? (
        <p className="text-sm text-ink-faint">{t.staff.dashboard.noActivity}</p>
      ) : (
        <ul className={staffCard}>
          {activity.map((entry) => {
            const { verb, title, when } = formatActivity(entry);
            return (
              <li
                key={entry.id}
                className="border-t border-line px-4 py-2.5 text-sm text-ink-soft first:border-t-0"
              >
                {title} {verb} · {when}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
