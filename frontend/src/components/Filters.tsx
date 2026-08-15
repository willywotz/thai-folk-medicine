import Link from "next/link";

export type FilterField =
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
    }
  | { kind: "text"; name: string; label: string; placeholder?: string };

export function Filters({
  action,
  fields,
  values,
}: {
  action: string;
  fields: FilterField[];
  values: Record<string, string | undefined>;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Filters"
      className="flex flex-wrap items-end gap-3"
    >
      {fields.map((field) => {
        const id = `filter-${field.name}`;
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-sm text-ink-faint">
              {field.label}
            </label>
            {field.kind === "select" ? (
              <select
                id={id}
                name={field.name}
                defaultValue={values[field.name] ?? ""}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">ทั้งหมด (all)</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type="text"
                name={field.name}
                defaultValue={values[field.name] ?? ""}
                placeholder={field.placeholder}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            )}
          </div>
        );
      })}
      <button
        type="submit"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
      >
        กรอง (filter)
      </button>
      <Link href={action} className="text-sm text-ink-faint hover:text-brand hover:underline">
        ล้าง (clear)
      </Link>
    </form>
  );
}
