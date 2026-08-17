export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";
export const hasLocale = (v: string): v is Locale =>
  (locales as readonly string[]).includes(v);
