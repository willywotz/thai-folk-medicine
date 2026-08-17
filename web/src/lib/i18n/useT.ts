import { useContext } from "react";

import { I18nContext } from "@/components/I18nProvider";

import { en } from "./dictionaries/en";
import { th } from "./dictionaries/th";

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx.locale === "en" ? en : th;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx.locale;
}
