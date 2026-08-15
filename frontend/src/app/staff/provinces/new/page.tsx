import { ProvinceForm } from "@/components/ProvinceForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";

export default function NewProvincePage() {
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Provinces", href: "/staff/provinces" }, { label: "New province" }]}
        eyebrow="จังหวัด · new record"
        title="Add a province"
      />
      <ProvinceForm />
    </section>
  );
}
