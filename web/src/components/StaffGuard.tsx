import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { Skeleton } from "./Skeleton";

export default function StaffGuard() {
  const { lang } = useParams();
  const q = useQuery({
    queryKey: ["session"],
    retry: false,
    queryFn: () => apiGet("/authentication/session"),
  });

  if (q.isLoading) return <Skeleton className="m-8 h-24" />;
  if (q.isError) return <Navigate to={`/${lang}/login`} replace />;
  return <Outlet />;
}
