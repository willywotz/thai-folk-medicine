import { createContext, type ReactNode } from "react";

import type { Locale } from "@/lib/i18n/config";

export const I18nContext = createContext<{ locale: Locale } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale }}>{children}</I18nContext.Provider>;
}
