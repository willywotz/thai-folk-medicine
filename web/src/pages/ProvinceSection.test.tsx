import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { getDistrict, getProvince } from "@/lib/api";

import { DistrictEditPage } from "./DistrictEditPage";
import { DistrictNewPage } from "./DistrictNewPage";
import { ProvinceDetailPage } from "./ProvinceDetailPage";
import { ProvinceEditPage } from "./ProvinceEditPage";
import { ProvinceNewPage } from "./ProvinceNewPage";
import { ProvincesPage } from "./ProvincesPage";

vi.mock("@/lib/api", () => ({
  getDistrict: vi.fn(),
  getProvince: vi.fn(),
}));

vi.mock("@/components/ProvinceAdminList", () => ({
  ProvinceAdminList: () => <div data-testid="province-admin-list" />,
}));
vi.mock("@/components/DistrictAdminList", () => ({
  DistrictAdminList: ({ provinceId }: { provinceId: number }) => (
    <div data-testid={`district-admin-list-${provinceId}`} />
  ),
}));
vi.mock("@/components/ProvinceForm", () => ({
  ProvinceForm: ({ province }: { province?: { id: number; nameThai: string } }) => (
    <div data-testid={province ? `province-form-${province.id}` : "province-form-new"} />
  ),
}));
vi.mock("@/components/DistrictForm", () => ({
  DistrictForm: ({ provinceId, district }: { provinceId: number; district?: { id: number } }) => (
    <div data-testid={district ? `district-form-${district.id}` : `district-form-new-${provinceId}`} />
  ),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderAt(path: string, element: React.ReactNode, route: string) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <I18nProvider locale="th">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const province = { id: 1, nameThai: "ยโสธร", nameEnglish: "Yasothon" };
const district = { id: 7, provinceId: 1, nameThai: "เมือง", nameEnglish: "Mueang" };

describe("ProvincesPage", () => {
  it("renders the staff header and ProvinceAdminList", () => {
    renderAt("/th/staff/provinces", <ProvincesPage />, "/:lang/staff/provinces");
    expect(screen.getByRole("heading", { name: th.staff.headers.provinces, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("province-admin-list")).toBeInTheDocument();
  });
});

describe("ProvinceNewPage", () => {
  it("renders ProvinceForm (no province prop) under a header", () => {
    renderAt("/th/staff/provinces/new", <ProvinceNewPage />, "/:lang/staff/provinces/new");
    expect(screen.getByRole("heading", { name: th.staff.addProvinceTitle, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("province-form-new")).toBeInTheDocument();
  });
});

describe("ProvinceDetailPage", () => {
  it("renders DistrictAdminList provinceId={id} when the province loads", async () => {
    vi.mocked(getProvince).mockResolvedValue(province);
    renderAt("/th/staff/provinces/1", <ProvinceDetailPage />, "/:lang/staff/provinces/:provinceId");
    expect(await screen.findByTestId("district-admin-list-1")).toBeInTheDocument();
    expect(getProvince).toHaveBeenCalledWith(1);
  });

  it("renders NotFound when the province does not exist", async () => {
    vi.mocked(getProvince).mockResolvedValue(null);
    renderAt("/th/staff/provinces/99", <ProvinceDetailPage />, "/:lang/staff/provinces/:provinceId");
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
    expect(getProvince).toHaveBeenCalledWith(99);
  });
});

describe("ProvinceEditPage", () => {
  it("renders ProvinceForm province={...} when the province loads", async () => {
    vi.mocked(getProvince).mockResolvedValue(province);
    renderAt("/th/staff/provinces/1/edit", <ProvinceEditPage />, "/:lang/staff/provinces/:provinceId/edit");
    expect(await screen.findByTestId("province-form-1")).toBeInTheDocument();
    expect(getProvince).toHaveBeenCalledWith(1);
  });

  it("renders NotFound when the province does not exist", async () => {
    vi.mocked(getProvince).mockResolvedValue(null);
    renderAt("/th/staff/provinces/99/edit", <ProvinceEditPage />, "/:lang/staff/provinces/:provinceId/edit");
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});

describe("DistrictNewPage", () => {
  it("renders DistrictForm provinceId={id} when the province loads", async () => {
    vi.mocked(getProvince).mockResolvedValue(province);
    renderAt(
      "/th/staff/provinces/1/districts/new",
      <DistrictNewPage />,
      "/:lang/staff/provinces/:provinceId/districts/new",
    );
    expect(await screen.findByTestId("district-form-new-1")).toBeInTheDocument();
    expect(getProvince).toHaveBeenCalledWith(1);
  });

  it("renders NotFound when the province does not exist", async () => {
    vi.mocked(getProvince).mockResolvedValue(null);
    renderAt(
      "/th/staff/provinces/99/districts/new",
      <DistrictNewPage />,
      "/:lang/staff/provinces/:provinceId/districts/new",
    );
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});

describe("DistrictEditPage", () => {
  it("renders DistrictForm provinceId district={...} when province and district match", async () => {
    vi.mocked(getProvince).mockResolvedValue(province);
    vi.mocked(getDistrict).mockResolvedValue(district);
    renderAt(
      "/th/staff/provinces/1/districts/7/edit",
      <DistrictEditPage />,
      "/:lang/staff/provinces/:provinceId/districts/:districtId/edit",
    );
    expect(await screen.findByTestId("district-form-7")).toBeInTheDocument();
    expect(getProvince).toHaveBeenCalledWith(1);
    expect(getDistrict).toHaveBeenCalledWith(7);
  });

  it("renders NotFound when district.provinceId mismatches the route provinceId", async () => {
    vi.mocked(getProvince).mockResolvedValue(province);
    vi.mocked(getDistrict).mockResolvedValue({ id: 7, provinceId: 999, nameThai: "x", nameEnglish: "x" });
    renderAt(
      "/th/staff/provinces/1/districts/7/edit",
      <DistrictEditPage />,
      "/:lang/staff/provinces/:provinceId/districts/:districtId/edit",
    );
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });

  it("renders NotFound when the district does not exist", async () => {
    vi.mocked(getProvince).mockResolvedValue(province);
    vi.mocked(getDistrict).mockResolvedValue(null);
    renderAt(
      "/th/staff/provinces/1/districts/7/edit",
      <DistrictEditPage />,
      "/:lang/staff/provinces/:provinceId/districts/:districtId/edit",
    );
    expect(await screen.findByText(th.common.home)).toBeInTheDocument();
  });
});
