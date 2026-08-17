export function DefinitionList({
  items,
}: {
  items: { term: string; value: string }[];
}) {
  const shown = items.filter((i) => i.value.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
      {shown.map((i) => (
        <div key={i.term} className="sm:contents">
          <dt className="font-semibold text-stone-600">{i.term}</dt>
          <dd className="whitespace-pre-line text-stone-800">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
