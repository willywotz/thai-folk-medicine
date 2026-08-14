export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form method="get" action="/search" className="flex gap-2">
      <input
        type="search"
        name="searchTerm"
        defaultValue={defaultValue}
        placeholder="ค้นหาอาการหรือสมุนไพร (search symptom or herb)"
        aria-label="Search symptom or herb"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white"
      >
        ค้นหา
      </button>
    </form>
  );
}
