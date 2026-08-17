import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";

import { LoginForm } from "@/components/LoginForm";
import { Skeleton } from "@/components/Skeleton";
import { apiGet } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function LoginPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const q = useQuery({
    queryKey: ["session"],
    retry: false,
    queryFn: () => apiGet("/authentication/session"),
  });

  if (q.isSuccess) return <Navigate to={`/${lang}/staff`} replace />;
  if (q.isPending) return <Skeleton className="m-8 h-24" />;
  return (
    <section>
      <h1 className="mb-6 text-center text-2xl font-bold">{t.login.title}</h1>
      <LoginForm />
    </section>
  );
}
