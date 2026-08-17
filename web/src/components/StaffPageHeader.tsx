import { Breadcrumb } from "@/components/Breadcrumb";

export function StaffPageHeader({
  crumbs,
  eyebrow,
  title,
}: {
  crumbs?: { label: string; href?: string }[];
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 ? <Breadcrumb items={crumbs} /> : null}
      {eyebrow ? (
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-brand">{eyebrow}</p>
      ) : null}
      <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
    </div>
  );
}
