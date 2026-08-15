import { notFound } from "next/navigation";
import { lang } from "next/root-params";

import { defaultLocale, hasLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { th } from "./dictionaries/th";
import type { Dictionary } from "./dictionaries/th";

const dictionaries: Record<Locale, Dictionary> = { th, en };

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!value) return defaultLocale;
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
