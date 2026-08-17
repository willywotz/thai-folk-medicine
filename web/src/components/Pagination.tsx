import { Link } from "react-router-dom";

import { useT } from "@/lib/i18n/useT";

const WINDOW_SIZE = 2;

function hrefFor(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  targetPage: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && key !== "page") {
      params.set(key, value);
    }
  }
  params.set("page", String(targetPage));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  page,
  totalPages,
  searchParams,
  basePath,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  basePath: string;
}) {
  const t = useT();
  if (totalPages <= 1) {
    return null;
  }
  const start = Math.max(1, page - WINDOW_SIZE);
  const end = Math.min(totalPages, page + WINDOW_SIZE);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 text-sm">
      {page > 1 ? (
        <Link to={hrefFor(basePath, searchParams, page - 1)} className="rounded px-2 py-1 hover:bg-brand-tint">
          <span aria-hidden>&laquo;</span>
          <span className="sr-only">{t.common.previous}</span>
        </Link>
      ) : null}
      {pages.map((p) => (
        <Link
          key={p}
          to={hrefFor(basePath, searchParams, p)}
          aria-current={p === page ? "page" : undefined}
          className={`rounded px-2.5 py-1 ${
            p === page ? "bg-brand text-white" : "hover:bg-brand-tint"
          }`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages ? (
        <Link to={hrefFor(basePath, searchParams, page + 1)} className="rounded px-2 py-1 hover:bg-brand-tint">
          <span aria-hidden>&raquo;</span>
          <span className="sr-only">{t.common.next}</span>
        </Link>
      ) : null}
    </nav>
  );
}
