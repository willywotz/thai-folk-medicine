"use client";

import { staffField } from "@/components/staff-ui";

/** StaffSearch is a controlled name-filter input for the staff admin lists. */
export function StaffSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={`${staffField} max-w-xs`}
    />
  );
}

/** matchesQuery reports whether any of the given fields contains the query (case-insensitive). */
export function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}
