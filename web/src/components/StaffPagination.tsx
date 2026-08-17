"use client";

import { btnGhost } from "@/components/staff-ui";
import { useT } from "@/lib/i18n/useT";

/** StaffPagination is a Prev/Next control for a server-paginated staff list. */
export function StaffPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const t = useT();
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className={`${btnGhost} px-3 py-1.5 disabled:opacity-50`}
      >
        {t.common.previous}
      </button>
      <span className="text-sm text-ink-faint">{t.common.pageXofY(page, totalPages)}</span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className={`${btnGhost} px-3 py-1.5 disabled:opacity-50`}
      >
        {t.common.next}
      </button>
    </nav>
  );
}
