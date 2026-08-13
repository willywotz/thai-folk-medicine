export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-stone-500">
      {message}
    </p>
  );
}
