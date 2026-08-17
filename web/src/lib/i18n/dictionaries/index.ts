import { th } from "./th";
import { en } from "./en";
import type { Locale } from "../config";

export type { Dictionary } from "./th";
export const dictionaries: Record<Locale, typeof th> = { th, en };
