import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@fontsource/noto-sans-thai";
import "@fontsource/noto-serif-thai";
import { NotFound } from "@/components/NotFound";
import { PublicLayout } from "@/components/PublicLayout";
import StaffGuard from "@/components/StaffGuard";
import { StaffLayout } from "@/components/StaffLayout";

import { CaseEditPage } from "@/pages/CaseEditPage";
import { CaseNewPage } from "@/pages/CaseNewPage";
import { CasesPage } from "@/pages/CasesPage";
import { DistrictEditPage } from "@/pages/DistrictEditPage";
import { DistrictNewPage } from "@/pages/DistrictNewPage";
import { DistrictPage } from "@/pages/DistrictPage";
import { DistrictsPage } from "@/pages/DistrictsPage";
import { HealerEditPage } from "@/pages/HealerEditPage";
import { HealerPage } from "@/pages/HealerPage";
import { HealerNewPage } from "@/pages/HealerNewPage";
import { HealerRemediesPage } from "@/pages/HealerRemediesPage";
import { HealersPage } from "@/pages/HealersPage";
import { HerbEditPage } from "@/pages/HerbEditPage";
import { HerbNewPage } from "@/pages/HerbNewPage";
import { HerbPage } from "@/pages/HerbPage";
import { HerbUsagePage } from "@/pages/HerbUsagePage";
import { HerbsPage } from "@/pages/HerbsPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { ProvinceDetailPage } from "@/pages/ProvinceDetailPage";
import { ProvinceEditPage } from "@/pages/ProvinceEditPage";
import { ProvinceNewPage } from "@/pages/ProvinceNewPage";
import { ProvincesPage } from "@/pages/ProvincesPage";
import { RemedyCasesPage } from "@/pages/RemedyCasesPage";
import { RemedyEditPage } from "@/pages/RemedyEditPage";
import { RemedyNewPage } from "@/pages/RemedyNewPage";
import { RemedyPage } from "@/pages/RemedyPage";
import { RemediesPage } from "@/pages/RemediesPage";
import { SearchPage } from "@/pages/SearchPage";
import { StaffDashboardPage } from "@/pages/StaffDashboardPage";
import { StaffHerbsPage } from "@/pages/StaffHerbsPage";
import { StaffRemediesPage } from "@/pages/StaffRemediesPage";
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
          { path: "login", element: <LoginPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
      {
        path: "staff",
        element: <StaffGuard />,
        errorElement: <NotFound />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <StaffDashboardPage /> },
              { path: "provinces", element: <ProvincesPage /> },
              { path: "provinces/new", element: <ProvinceNewPage /> },
              { path: "provinces/:provinceId", element: <ProvinceDetailPage /> },
              { path: "provinces/:provinceId/edit", element: <ProvinceEditPage /> },
              { path: "provinces/:provinceId/districts/new", element: <DistrictNewPage /> },
              { path: "provinces/:provinceId/districts/:districtId/edit", element: <DistrictEditPage /> },
              { path: "healers", element: <HealersPage /> },
              { path: "healers/new", element: <HealerNewPage /> },
              { path: "healers/:healerId/edit", element: <HealerEditPage /> },
              { path: "healers/:healerId/remedies", element: <HealerRemediesPage /> },
              { path: "remedies", element: <StaffRemediesPage /> },
              { path: "remedies/new", element: <RemedyNewPage /> },
              { path: "remedies/:remedyId/edit", element: <RemedyEditPage /> },
              { path: "remedies/:remedyId/treatment-cases", element: <RemedyCasesPage /> },
              { path: "cases", element: <CasesPage /> },
              { path: "cases/new", element: <CaseNewPage /> },
              { path: "cases/:treatmentCaseId/edit", element: <CaseEditPage /> },
              { path: "herbs", element: <StaffHerbsPage /> },
              { path: "herbs/new", element: <HerbNewPage /> },
              { path: "herbs/:herbId", element: <HerbUsagePage /> },
              { path: "herbs/:herbId/edit", element: <HerbEditPage /> },
              { path: "*", element: <NotFound /> },
            ],
          },
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
