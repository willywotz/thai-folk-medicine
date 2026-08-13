/** Formats an ISO date (YYYY-MM-DD or RFC3339) as "D Month YYYY". */
export function formatThaiDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Turns a stored patient-sex value into a display label. */
export function patientSexLabel(sex: string): string {
  if (sex === "female") return "Female";
  if (sex === "male") return "Male";
  return sex;
}
