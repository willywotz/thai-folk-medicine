import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useT } from "@/lib/i18n/useT";

export function SearchBox({
  defaultValue = "",
  size = "lg",
}: {
  defaultValue?: string;
  size?: "sm" | "lg";
}) {
  const t = useT();
  const { lang = "th" } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState(defaultValue);
  const pad = size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2 text-sm";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/${lang}/search?searchTerm=${encodeURIComponent(term.trim())}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="search"
        name="searchTerm"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t.search.boxPlaceholder}
        aria-label={t.search.boxPlaceholder}
        className={`w-full rounded-xl border border-line bg-surface text-ink ${pad}`}
      />
      <button type="submit" className="rounded-xl bg-brand px-5 font-semibold text-white">
        {t.common.search}
      </button>
    </form>
  );
}
