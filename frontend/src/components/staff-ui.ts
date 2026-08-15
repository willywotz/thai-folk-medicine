// Shared brand-token class strings for the staff zone, so lists and forms
// keep one consistent look. Colors come from the --brand/--ink/--line theme.

export const staffCard = "rounded-xl border border-line bg-surface shadow-sm";

export const staffField =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export const staffLabel = "block text-sm font-medium text-ink";

export const staffFieldError = "text-sm text-destructive";

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand";

// Small square icon action button used in list rows.
export const iconBtn =
  "grid size-8 place-items-center rounded-lg border border-transparent text-ink-soft hover:border-line hover:bg-surface hover:text-ink";

export const iconBtnDanger =
  "grid size-8 place-items-center rounded-lg border border-transparent text-ink-soft hover:border-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50";

// Text link action (e.g. "Remedies", "Cases").
export const linkAction =
  "rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand hover:bg-brand-tint";
