import { notFound } from "next/navigation";

import { RemedyAdminList } from "@/components/RemedyAdminList";
import { getHealer } from "@/lib/api";

export default async function StaffRemediesPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Remedies of {healer.fullName}</h1>
      <RemedyAdminList healerId={id} />
    </section>
  );
}
