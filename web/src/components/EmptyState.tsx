export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-surface-2 p-6 text-center text-ink-faint">
      {message}
    </p>
  );
}
