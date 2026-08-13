import { notFound } from "next/navigation";

import { RemedyForm } from "@/components/RemedyForm";
import { getRemedy } from "@/lib/api";

export default async function EditRemedyPage({
  params,
}: {
  params: Promise<{ healerId: string; remedyId: string }>;
}) {
  const { healerId, remedyId } = await params;
  const hId = Number(healerId);
  const rId = Number(remedyId);
  if (!Number.isInteger(hId) || hId <= 0 || !Number.isInteger(rId) || rId <= 0) notFound();

  const remedy = await getRemedy(rId);
  if (!remedy) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit remedy</h1>
      <RemedyForm healerId={hId} remedy={remedy} />
    </section>
  );
}
