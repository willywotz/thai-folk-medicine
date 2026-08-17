import { useContext } from "react";
import { I18nContext } from "./provider";

export function useT() {
  return useContext(I18nContext);
}
