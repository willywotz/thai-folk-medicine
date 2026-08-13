import { notFound } from "next/navigation";

import { RemedyForm } from "@/components/RemedyForm";

export default async function NewRemedyPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">New remedy</h1>
      <RemedyForm healerId={id} />
    </section>
  );
}
