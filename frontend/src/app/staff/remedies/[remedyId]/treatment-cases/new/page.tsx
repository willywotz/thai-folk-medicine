import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
import { getRemedy } from "@/lib/api";

export default async function NewCasePage({
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
      <h1 className="mb-4 text-xl font-bold">New treatment case</h1>
      <CaseForm remedyId={id} healerId={remedy.healerId} />
    </section>
  );
}
