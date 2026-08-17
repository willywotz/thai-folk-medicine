import { createContext, type ReactNode } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { defaultLocale, hasLocale, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

export const I18nContext = createContext<{ lang: Locale; t: Dictionary }>({
  lang: defaultLocale,
  t: dictionaries[defaultLocale],
});

export function LangLayout({ children }: { children?: ReactNode }) {
  const { lang } = useParams();
  if (!lang || !hasLocale(lang)) return <Navigate to={`/${defaultLocale}`} replace />;
  return (
    <I18nContext.Provider value={{ lang, t: dictionaries[lang] }}>
      {children ?? <Outlet />}
    </I18nContext.Provider>
  );
}
