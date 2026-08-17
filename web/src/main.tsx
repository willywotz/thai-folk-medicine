import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@fontsource/noto-sans-thai";
import "@fontsource/noto-serif-thai";
import { NotFound } from "@/components/NotFound";
import { PublicLayout } from "@/components/PublicLayout";
import { DistrictPage } from "@/pages/DistrictPage";
import { DistrictsPage } from "@/pages/DistrictsPage";
import { HealerPage } from "@/pages/HealerPage";
import { HerbPage } from "@/pages/HerbPage";
import { HerbsPage } from "@/pages/HerbsPage";
import { HomePage } from "@/pages/HomePage";
import { RemedyPage } from "@/pages/RemedyPage";
import { RemediesPage } from "@/pages/RemediesPage";
import { SearchPage } from "@/pages/SearchPage";
import { TreatmentCasesPage } from "@/pages/TreatmentCasesPage";
import { defaultLocale } from "@/lib/i18n/config";
import { LangLayout } from "@/lib/i18n/LangLayout";
import "./index.css";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Navigate to={`/${defaultLocale}`} replace /> },
  {
    path: "/:lang",
    element: <LangLayout />,
    children: [
      {
        element: <PublicLayout />,
        errorElement: <NotFound />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "herbs", element: <HerbsPage /> },
          { path: "herbs/:herbId", element: <HerbPage /> },
          { path: "remedies", element: <RemediesPage /> },
          { path: "remedies/:remedyId", element: <RemedyPage /> },
          { path: "districts", element: <DistrictsPage /> },
          { path: "districts/:districtId", element: <DistrictPage /> },
          { path: "healers/:healerId", element: <HealerPage /> },
          { path: "search", element: <SearchPage /> },
          { path: "treatment-cases", element: <TreatmentCasesPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
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
