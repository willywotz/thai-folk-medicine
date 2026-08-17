import { Link, useParams } from "react-router-dom";

import { useT } from "@/lib/i18n/useT";

export function NotFound() {
  const { lang } = useParams();
  const t = useT();
  return (
    <div className="p-8">
      <h1 className="text-xl">404</h1>
      <Link to={`/${lang ?? "th"}`} className="underline">
        {t.common.home}
      </Link>
    </div>
  );
}
