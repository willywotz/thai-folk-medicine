import { notFound } from "next/navigation";

import { RemedyForm } from "@/components/RemedyForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getHealer } from "@/lib/api";

export default async function NewRemedyPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const healer = await getHealer(id);

  const crumbs = [
    { label: "Districts", href: "/staff" },
    ...(healer ? [{ label: healer.fullName, href: `/staff/healers/${id}/remedies` }] : []),
    { label: "New remedy" },
  ];

  return (
    <section>
      <StaffPageHeader crumbs={crumbs} eyebrow="new record" title="Add a remedy" />
      <RemedyForm healerId={id} />
    </section>
  );
}
