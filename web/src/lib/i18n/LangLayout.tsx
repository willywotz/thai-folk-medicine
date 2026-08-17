import { Navigate, Outlet, useParams } from "react-router-dom";

import { I18nProvider } from "@/components/I18nProvider";

import { defaultLocale, hasLocale } from "./config";

export function LangLayout() {
  const { lang } = useParams();
  if (!lang || !hasLocale(lang)) return <Navigate to={`/${defaultLocale}`} replace />;
  return (
    <I18nProvider locale={lang}>
      <Outlet />
    </I18nProvider>
  );
}
