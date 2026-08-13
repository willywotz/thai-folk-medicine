import { notFound } from "next/navigation";

import { CaseAdminList } from "@/components/CaseAdminList";
import { getRemedy } from "@/lib/api";

export default async function StaffCasesPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Treatment cases for {remedy.name}</h1>
      <CaseAdminList remedyId={id} />
    </section>
  );
}
