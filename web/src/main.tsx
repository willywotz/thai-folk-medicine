import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { defaultLocale } from "@/lib/i18n/config";
import { LangLayout } from "@/lib/i18n/LangLayout";
import "./index.css";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Navigate to={`/${defaultLocale}`} replace /> },
  {
    path: "/:lang",
    element: <LangLayout />,
    children: [{ index: true, element: <div className="p-8">home placeholder</div> }],
  },
  { path: "*", element: <Navigate to={`/${defaultLocale}`} replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
