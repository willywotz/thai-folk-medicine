import { getDictionary } from "@/lib/i18n/getDictionary";

export async function SearchBox({
  defaultValue = "",
  size = "lg",
}: {
  defaultValue?: string;
  size?: "sm" | "lg";
}) {
  const t = await getDictionary();
  const pad = size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2 text-sm";
  return (
    <form method="get" action="/search" className="flex gap-2">
      <input
        type="search"
        name="searchTerm"
        defaultValue={defaultValue}
        placeholder={t.search.boxPlaceholder}
        aria-label="Search symptom or herb"
        className={`w-full rounded-xl border border-line bg-surface text-ink ${pad}`}
      />
      <button
        type="submit"
        className="rounded-xl bg-brand px-5 font-semibold text-white"
      >
        {t.common.search}
      </button>
    </form>
  );
}
